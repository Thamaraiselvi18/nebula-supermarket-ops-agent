import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

import {
  db,
  transaction,
  normalizeName,
  paiseToRupees,
  formatINR,
  calculateGST,
} from "../db/schema.js";

import { generateInvoicePdf } from "../artifacts/invoice.js";

/* =========================================================
   TYPES
   ========================================================= */

type PaymentMode =
  | "CASH"
  | "UPI"
  | "CARD";

/* =========================================================
   HELPERS
   ========================================================= */

function makeBillNumber(): string {
  const now = new Date();

  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  return `INV-${date}-${random}`;
}

function getActiveBill(ownerKey: string) {
  const row = db
    .prepare(`
      SELECT b.*
      FROM bills b
      JOIN agent_sessions s
        ON s.active_bill_id = b.id
      WHERE
        s.owner_key = ?
        AND b.status = 'DRAFT'
      LIMIT 1
    `)
    .get(ownerKey) as any;

  return row ?? null;
}

function getBillById(billId: number) {
  return db
    .prepare(`
      SELECT *
      FROM bills
      WHERE id = ?
      LIMIT 1
    `)
    .get(billId) as any;
}

function getBillItems(billId: number) {
  return db
    .prepare(`
      SELECT
        bi.*,
        p.quantity AS current_stock
      FROM bill_items bi
      JOIN products p
        ON p.id = bi.product_id
      WHERE bi.bill_id = ?
      ORDER BY bi.id
    `)
    .all(billId) as any[];
}

/* =========================================================
   BILL CALCULATION
   ========================================================= */

function recalculateBill(billId: number) {
  const items = getBillItems(billId);

  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let tax = 0;

  for (const item of items) {
    /*
     * taxablePaise belongs to the bill item calculation.
     * calculateGST() returns:
     * cgstPaise
     * sgstPaise
     * taxPaise
     * totalPaise
     */

    const taxablePaise = Math.round(
      Number(item.quantity) *
      Number(item.unit_price_paise)
    );

    const gst = calculateGST(
      taxablePaise,
      Number(item.gst_rate)
    );

    db.prepare(`
      UPDATE bill_items
      SET
        taxable_paise = ?,
        cgst_paise = ?,
        sgst_paise = ?,
        tax_paise = ?,
        total_paise = ?
      WHERE id = ?
    `).run(
      taxablePaise,
      gst.cgstPaise,
      gst.sgstPaise,
      gst.taxPaise,
      taxablePaise + gst.taxPaise,
      item.id
    );

    subtotal += taxablePaise;
    cgst += gst.cgstPaise;
    sgst += gst.sgstPaise;
    tax += gst.taxPaise;
  }

  const total = subtotal + tax;

  db.prepare(`
    UPDATE bills
    SET
      subtotal_paise = ?,
      cgst_paise = ?,
      sgst_paise = ?,
      tax_paise = ?,
      total_paise = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    subtotal,
    cgst,
    sgst,
    tax,
    total,
    billId
  );

  return {
    subtotalPaise: subtotal,
    cgstPaise: cgst,
    sgstPaise: sgst,
    taxPaise: tax,
    totalPaise: total,
  };
}

/* =========================================================
   PRODUCT RESOLUTION
   ========================================================= */

function findProduct(name: string) {
  const normalized = normalizeName(name);

  const exact = db
    .prepare(`
      SELECT *
      FROM products
      WHERE
        normalized_name = ?
        AND active = 1
      LIMIT 1
    `)
    .get(normalized) as any;

  if (exact) {
    return {
      type: "exact" as const,
      product: exact,
      candidates: [exact],
    };
  }

  const candidates = db
    .prepare(`
      SELECT *
      FROM products
      WHERE
        active = 1
        AND (
          normalized_name LIKE ?
          OR name LIKE ?
        )
      ORDER BY name
      LIMIT 10
    `)
    .all(
      `%${normalized}%`,
      `%${name.trim()}%`
    ) as any[];

  if (candidates.length === 1) {
    return {
      type: "exact" as const,
      product: candidates[0],
      candidates,
    };
  }

  if (candidates.length > 1) {
    return {
      type: "ambiguous" as const,
      product: null,
      candidates,
    };
  }

  return {
    type: "none" as const,
    product: null,
    candidates: [],
  };
}

/* =========================================================
   BILL OUTPUT
   ========================================================= */

function formatBill(billId: number) {
  const bill = getBillById(billId);

  if (!bill) {
    throw new Error("Bill not found.");
  }

  const items = getBillItems(billId);

  return {
    billId: bill.id,
    billNumber: bill.bill_number,
    status: bill.status,
    customerName: bill.customer_name,

    paymentMode: bill.payment_mode,
    paymentReference: bill.payment_reference,

    items: items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: Number(item.quantity),
      unit: item.unit,

      unitPrice: paiseToRupees(
        Number(item.unit_price_paise)
      ),

      taxable: paiseToRupees(
        Number(item.taxable_paise)
      ),

      gstRate: Number(item.gst_rate),

      cgst: paiseToRupees(
        Number(item.cgst_paise)
      ),

      sgst: paiseToRupees(
        Number(item.sgst_paise)
      ),

      tax: paiseToRupees(
        Number(item.tax_paise)
      ),

      total: paiseToRupees(
        Number(item.total_paise)
      ),
    })),

    subtotal: paiseToRupees(
      Number(bill.subtotal_paise)
    ),

    cgst: paiseToRupees(
      Number(bill.cgst_paise)
    ),

    sgst: paiseToRupees(
      Number(bill.sgst_paise)
    ),

    tax: paiseToRupees(
      Number(bill.tax_paise)
    ),

    total: paiseToRupees(
      Number(bill.total_paise)
    ),
  };
}

/* =========================================================
   CREATE BILL
   ========================================================= */

const createBill = tool({
  description: `
Create or continue a draft supermarket bill.

Use this when the owner asks to create a bill.

Important:
- Resolve products from the database.
- Never invent prices.
- Never guess ambiguous products.
- Stock is NOT decremented here.
- The bill remains a DRAFT until finalize_bill.
- If an active draft exists for this owner, continue it.
`,

  inputSchema: z.object({
    ownerKey: z.string(),

    items: z.array(
      z.object({
        productName: z.string(),
        quantity: z.number().positive(),
      })
    ).min(1),

    customerName: z.string().optional(),

    paymentMode: z
      .enum(["CASH", "UPI", "CARD"])
      .optional(),

    paymentReference: z
      .string()
      .optional(),
  }),

  execute: async ({
    ownerKey,
    items,
    customerName,
    paymentMode,
    paymentReference,
  }) => {
    return transaction(() => {
      let bill = getActiveBill(ownerKey);

      let billId: number;

      /* ---------------------------------------------------
         CREATE NEW DRAFT
         --------------------------------------------------- */

      if (!bill) {
        const billNumber = makeBillNumber();

        const result = db
          .prepare(`
            INSERT INTO bills (
              bill_number,
              owner_key,
              customer_name,
              status,
              payment_mode,
              payment_reference
            )
            VALUES (?, ?, ?, 'DRAFT', ?, ?)
          `)
          .run(
            billNumber,
            ownerKey,
            customerName ?? null,
            paymentMode ?? null,
            paymentReference ?? null
          );

        billId = Number(result.lastInsertRowid);

        db.prepare(`
          INSERT INTO agent_sessions (
            owner_key,
            active_bill_id
          )
          VALUES (?, ?)
          ON CONFLICT(owner_key)
          DO UPDATE SET
            active_bill_id = excluded.active_bill_id,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          ownerKey,
          billId
        );
      }

      /* ---------------------------------------------------
         CONTINUE EXISTING DRAFT
         --------------------------------------------------- */

      else {
        billId = Number(bill.id);

        if (customerName !== undefined) {
          db.prepare(`
            UPDATE bills
            SET
              customer_name = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            customerName,
            billId
          );
        }

        if (paymentMode !== undefined) {
          db.prepare(`
            UPDATE bills
            SET
              payment_mode = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            paymentMode,
            billId
          );
        }

        if (paymentReference !== undefined) {
          db.prepare(`
            UPDATE bills
            SET
              payment_reference = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            paymentReference,
            billId
          );
        }
      }

      /* ---------------------------------------------------
         ADD PRODUCTS
         --------------------------------------------------- */

      for (const requested of items) {
        const resolved = findProduct(
          requested.productName
        );

        if (resolved.type === "none") {
          throw new Error(
            `Product "${requested.productName}" was not found in the inventory.`
          );
        }

        if (resolved.type === "ambiguous") {
          const names = resolved.candidates
            .map((p: any) => p.name)
            .join(", ");

          throw new Error(
            `Product "${requested.productName}" is ambiguous. Please choose one: ${names}`
          );
        }

        const product = resolved.product;

        if (!product) {
          throw new Error(
            "Unable to resolve product."
          );
        }

        if (
          Number(product.sell_price_paise) <
          Number(product.cost_price_paise)
        ) {
          throw new Error(
            `${product.name} cannot be sold because its selling price is below cost.`
          );
        }

        const existing = db
          .prepare(`
            SELECT *
            FROM bill_items
            WHERE
              bill_id = ?
              AND product_id = ?
            LIMIT 1
          `)
          .get(
            billId,
            product.id
          ) as any;

        if (existing) {
          const newQuantity =
            Number(existing.quantity) +
            Number(requested.quantity);

          db.prepare(`
            UPDATE bill_items
            SET quantity = ?
            WHERE id = ?
          `).run(
            newQuantity,
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO bill_items (
              bill_id,
              product_id,
              product_name,
              quantity,
              unit,
              unit_price_paise,
              cost_price_paise,
              gst_rate,
              hsn_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            billId,
            product.id,
            product.name,
            requested.quantity,
            product.unit,
            product.sell_price_paise,
            product.cost_price_paise,
            product.gst_rate,
            product.hsn_code
          );
        }
      }

      const totals = recalculateBill(
        billId
      );

      return {
        success: true,
        action: "DRAFT_CREATED_OR_UPDATED",

        message:
          "Draft bill created/updated. Stock has not been deducted.",

        bill: formatBill(billId),

        totals: {
          subtotal: formatINR(
            totals.subtotalPaise
          ),

          cgst: formatINR(
            totals.cgstPaise
          ),

          sgst: formatINR(
            totals.sgstPaise
          ),

          tax: formatINR(
            totals.taxPaise
          ),

          total: formatINR(
            totals.totalPaise
          ),
        },
      };
    });
  },
});

/* =========================================================
   GET DRAFT BILL
   ========================================================= */

const getDraftBill = tool({
  description: `
Get the current active draft bill for this Telegram owner.

Use this before editing, removing items, changing quantities,
or finalizing when the bill was created in an earlier message.
`,

  inputSchema: z.object({
    ownerKey: z.string(),
  }),

  execute: async ({ ownerKey }) => {
    const bill = getActiveBill(ownerKey);

    if (!bill) {
      return {
        success: true,
        hasDraft: false,
        message:
          "There is no active draft bill.",
      };
    }

    return {
      success: true,
      hasDraft: true,
      bill: formatBill(
        Number(bill.id)
      ),
    };
  },
});

/* =========================================================
   EDIT BILL
   ========================================================= */

const editBill = tool({
  description: `
Edit the current draft bill.

Supported operations:
- ADD
- REMOVE
- SET_QUANTITY

Examples:
- remove the butter
- drop Maggi
- make Maggi 6
- change sugar to 3kg
- add 2 more salt

Stock is never changed while editing.
`,

  inputSchema: z.object({
    ownerKey: z.string(),

    operations: z.array(
      z.object({
        action: z.enum([
          "ADD",
          "REMOVE",
          "SET_QUANTITY",
        ]),

        productName: z.string(),

        quantity: z
          .number()
          .positive()
          .optional(),
      })
    ).min(1),
  }),

  execute: async ({
    ownerKey,
    operations,
  }) => {
    return transaction(() => {
      const bill = getActiveBill(
        ownerKey
      );

      if (!bill) {
        throw new Error(
          "There is no active draft bill to edit."
        );
      }

      const billId = Number(
        bill.id
      );

      for (const operation of operations) {
        const resolved = findProduct(
          operation.productName
        );

        if (resolved.type === "none") {
          throw new Error(
            `Product "${operation.productName}" was not found.`
          );
        }

        if (resolved.type === "ambiguous") {
          const names =
            resolved.candidates
              .map(
                (p: any) => p.name
              )
              .join(", ");

          throw new Error(
            `Product "${operation.productName}" is ambiguous. Choose: ${names}`
          );
        }

        const product =
          resolved.product;

        if (!product) {
          throw new Error(
            "Unable to resolve product."
          );
        }

        const existing = db
          .prepare(`
            SELECT *
            FROM bill_items
            WHERE
              bill_id = ?
              AND product_id = ?
            LIMIT 1
          `)
          .get(
            billId,
            product.id
          ) as any;

        /* -------------------------------------------------
           REMOVE
           ------------------------------------------------- */

        if (
          operation.action ===
          "REMOVE"
        ) {
          if (!existing) {
            throw new Error(
              `${product.name} is not in the draft bill.`
            );
          }

          db.prepare(`
            DELETE FROM bill_items
            WHERE id = ?
          `).run(existing.id);
        }

        /* -------------------------------------------------
           SET QUANTITY
           ------------------------------------------------- */

        else if (
          operation.action ===
          "SET_QUANTITY"
        ) {
          if (
            operation.quantity ===
            undefined
          ) {
            throw new Error(
              `Quantity is required for ${product.name}.`
            );
          }

          if (!existing) {
            db.prepare(`
              INSERT INTO bill_items (
                bill_id,
                product_id,
                product_name,
                quantity,
                unit,
                unit_price_paise,
                cost_price_paise,
                gst_rate,
                hsn_code
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              billId,
              product.id,
              product.name,
              operation.quantity,
              product.unit,
              product.sell_price_paise,
              product.cost_price_paise,
              product.gst_rate,
              product.hsn_code
            );
          } else {
            db.prepare(`
              UPDATE bill_items
              SET quantity = ?
              WHERE id = ?
            `).run(
              operation.quantity,
              existing.id
            );
          }
        }

        /* -------------------------------------------------
           ADD
           ------------------------------------------------- */

        else if (
          operation.action ===
          "ADD"
        ) {
          if (
            Number(product.sell_price_paise) <
            Number(product.cost_price_paise)
          ) {
            throw new Error(
              `${product.name} cannot be sold below cost.`
            );
          }

          if (
            operation.quantity ===
            undefined
          ) {
            throw new Error(
              `Quantity is required for ${product.name}.`
            );
          }

          if (!existing) {
            db.prepare(`
              INSERT INTO bill_items (
                bill_id,
                product_id,
                product_name,
                quantity,
                unit,
                unit_price_paise,
                cost_price_paise,
                gst_rate,
                hsn_code
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              billId,
              product.id,
              product.name,
              operation.quantity,
              product.unit,
              product.sell_price_paise,
              product.cost_price_paise,
              product.gst_rate,
              product.hsn_code
            );
          } else {
            db.prepare(`
              UPDATE bill_items
              SET quantity = quantity + ?
              WHERE id = ?
            `).run(
              operation.quantity,
              existing.id
            );
          }
        }
      }

      const totals =
        recalculateBill(
          billId
        );

      return {
        success: true,
        action: "DRAFT_EDITED",

        message:
          "Draft bill updated. Stock has not been deducted.",

        bill: formatBill(
          billId
        ),

        total: formatINR(
          totals.totalPaise
        ),
      };
    });
  },
});

/* =========================================================
   FINALIZE BILL
   ========================================================= */

const finalizeBill = tool({
  description: `
Finalize the active draft bill.

This is the ONLY operation that converts a draft into a sale.

Rules:
1. Validate every item.
2. Prevent overselling.
3. Validate payment.
4. Atomically decrement stock.
5. Record stock movements.
6. Mark bill FINALIZED.
7. Save idempotency key.
8. Clear active draft.

If the same idempotency key is received again,
return the previous result without deducting stock again.
`,

  inputSchema: z.object({
    ownerKey: z.string(),

    paymentMode: z
      .enum([
        "CASH",
        "UPI",
        "CARD",
      ])
      .optional(),

    paymentReference:
      z.string().optional(),

    idempotencyKey:
      z.string().optional(),
  }),

  execute: async ({
    ownerKey,
    paymentMode,
    paymentReference,
    idempotencyKey,
  }) => {
    return transaction(() => {

      /* ---------------------------------------------------
         IDEMPOTENCY CHECK
         --------------------------------------------------- */

      if (idempotencyKey) {
        const previous =
          db.prepare(`
            SELECT result_json
            FROM idempotency_keys
            WHERE
              owner_key = ?
              AND idempotency_key = ?
            LIMIT 1
          `).get(
            ownerKey,
            idempotencyKey
          ) as any;

        if (previous) {
          return JSON.parse(
            previous.result_json
          );
        }
      }

      /* ---------------------------------------------------
         ACTIVE DRAFT
         --------------------------------------------------- */

      const bill =
        getActiveBill(
          ownerKey
        );

      if (!bill) {
        throw new Error(
          "There is no active draft bill to finalize."
        );
      }

      const billId =
        Number(bill.id);

      const current =
        getBillById(
          billId
        );

      if (!current) {
        throw new Error(
          "Bill not found."
        );
      }

      if (
        current.status !==
        "DRAFT"
      ) {
        throw new Error(
          `Bill ${current.bill_number} is already ${current.status}.`
        );
      }

      /* ---------------------------------------------------
         ITEMS
         --------------------------------------------------- */

      let items =
        getBillItems(
          billId
        );

      if (items.length === 0) {
        throw new Error(
          "Cannot finalize an empty bill."
        );
      }

      /* ---------------------------------------------------
         PAYMENT
         --------------------------------------------------- */

      const finalPaymentMode =
        paymentMode ??
        current.payment_mode;

      const finalPaymentReference =
        paymentReference ??
        current.payment_reference;

      if (!finalPaymentMode) {
        throw new Error(
          "Payment mode is required. Choose Cash, UPI or Card."
        );
      }

      if (
        finalPaymentMode !==
          "CASH" &&
        !finalPaymentReference
      ) {
        throw new Error(
          `${finalPaymentMode} payment requires a payment reference.`
        );
      }

      /* ---------------------------------------------------
         RECALCULATE BEFORE SALE
         --------------------------------------------------- */

      recalculateBill(
        billId
      );

      items =
        getBillItems(
          billId
        );

      /* ---------------------------------------------------
         VALIDATE ALL STOCK FIRST
         --------------------------------------------------- */

      for (const item of items) {
        const product =
          db.prepare(`
            SELECT *
            FROM products
            WHERE id = ?
            LIMIT 1
          `).get(
            item.product_id
          ) as any;

        if (!product) {
          throw new Error(
            `Product ${item.product_name} no longer exists.`
          );
        }

        if (!product.active) {
          throw new Error(
            `${product.name} is inactive and cannot be sold.`
          );
        }

        if (
          Number(
            product.sell_price_paise
          ) <
          Number(
            product.cost_price_paise
          )
        ) {
          throw new Error(
            `${product.name} cannot be sold below cost.`
          );
        }

        if (
          Number(product.quantity) <
          Number(item.quantity)
        ) {
          throw new Error(
            `Oversell blocked: ${product.name} has only ${product.quantity} ${product.unit} in stock, but the bill requires ${item.quantity}.`
          );
        }
      }

      /* ---------------------------------------------------
         ATOMIC STOCK DECREMENT
         --------------------------------------------------- */

      for (const item of items) {
        const result =
          db.prepare(`
            UPDATE products
            SET
              quantity = quantity - ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE
              id = ?
              AND quantity >= ?
              AND active = 1
          `).run(
            Number(item.quantity),
            Number(item.product_id),
            Number(item.quantity)
          );

        if (
          result.changes !== 1
        ) {
          throw new Error(
            `Sale could not be completed because stock changed for ${item.product_name}. Please retry the bill.`
          );
        }

        db.prepare(`
          INSERT INTO stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            note
          )
          VALUES (
            ?,
            'SALE',
            ?,
            'BILL',
            ?,
            ?
          )
        `).run(
          item.product_id,
          -Number(item.quantity),
          billId,
          `Sale ${current.bill_number}`
        );
      }

      /* ---------------------------------------------------
         FINALIZE BILL
         --------------------------------------------------- */

      const finalKey =
        idempotencyKey ??
        `bill-${billId}`;

      const updateResult =
        db.prepare(`
          UPDATE bills
          SET
            status = 'FINALIZED',
            payment_mode = ?,
            payment_reference = ?,
            finalized_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            idempotency_key = ?
          WHERE
            id = ?
            AND status = 'DRAFT'
        `).run(
          finalPaymentMode,
          finalPaymentReference ??
            null,
          finalKey,
          billId
        );

      if (
        updateResult.changes !== 1
      ) {
        throw new Error(
          "Bill could not be finalized. It may have already been finalized."
        );
      }

      /* ---------------------------------------------------
         CLEAR ACTIVE DRAFT
         --------------------------------------------------- */

      db.prepare(`
        UPDATE agent_sessions
        SET
          active_bill_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE owner_key = ?
      `).run(ownerKey);

      /* ---------------------------------------------------
         FINAL RESULT
         --------------------------------------------------- */

      const finalBill =
        getBillById(
          billId
        );

      if (!finalBill) {
        throw new Error(
          "Finalized bill could not be loaded."
        );
      }

      const result = {
        success: true,
        alreadyFinalized: false,

        message:
          "Bill finalized successfully. Stock has been deducted atomically.",

        bill: formatBill(
          billId
        ),
      };

      /* ---------------------------------------------------
         SAVE IDEMPOTENCY RESULT
         --------------------------------------------------- */

      if (idempotencyKey) {
        db.prepare(`
          INSERT INTO idempotency_keys (
            owner_key,
            idempotency_key,
            result_json
          )
          VALUES (?, ?, ?)
          ON CONFLICT(owner_key, idempotency_key)
          DO NOTHING
        `).run(
          ownerKey,
          idempotencyKey,
          JSON.stringify(result)
        );
      }

      return result;
    });
  },
});

/* =========================================================
   GET BILL
   ========================================================= */

const getBill = tool({
  description: `
Get a bill by bill number or bill ID.

Use this when the owner asks to see a previous bill.
`,

  inputSchema: z
    .object({
      billId: z
        .number()
        .int()
        .positive()
        .optional(),

      billNumber: z
        .string()
        .optional(),
    })
    .refine(
      (value) =>
        value.billId !== undefined ||
        value.billNumber !== undefined,
      {
        message:
          "Provide either billId or billNumber.",
      }
    ),

  execute: async ({
    billId,
    billNumber,
  }) => {
    let bill: any;

    if (
      billId !== undefined
    ) {
      bill = db
        .prepare(`
          SELECT *
          FROM bills
          WHERE id = ?
          LIMIT 1
        `)
        .get(
          billId
        );
    } else {
      bill = db
        .prepare(`
          SELECT *
          FROM bills
          WHERE bill_number = ?
          LIMIT 1
        `)
        .get(
          billNumber
        );
    }

    if (!bill) {
      throw new Error(
        "Bill not found."
      );
    }

    return {
      success: true,
      bill: formatBill(
        Number(bill.id)
      ),
    };
  },
});

/* =========================================================
   GENERATE INVOICE PDF
   ========================================================= */

const generateInvoice = tool({
  description: `
Generate a proper GST PDF invoice for a finalized bill.

Use this when the owner asks:
- send me that bill as PDF
- invoice PDF
- generate invoice
`,

  inputSchema: z.object({
    billId: z
      .number()
      .int()
      .positive(),
  }),

  execute: async ({
    billId,
  }) => {
    const bill =
      getBillById(
        billId
      );

    if (!bill) {
      throw new Error(
        "Bill not found."
      );
    }

    if (
      bill.status !==
      "FINALIZED"
    ) {
      throw new Error(
        "Invoice PDF can only be generated for a finalized bill."
      );
    }

    const items =
      getBillItems(
        billId
      );

    const shopName =
      process.env.SHOP_NAME ||
      "Nebula Kirana";

    const shopGSTIN =
      process.env.SHOP_GSTIN ||
      "";

    const outputDir =
      path.resolve(
        "./data/artifacts"
      );

    fs.mkdirSync(
      outputDir,
      {
        recursive: true,
      }
    );

    const outputPath =
      path.join(
        outputDir,
        `${bill.bill_number}.pdf`
      );

    await generateInvoicePdf({
      outputPath,

      shopName,
      shopGSTIN,

      billNumber:
        bill.bill_number,

      createdAt:
        bill.created_at,

      finalizedAt:
        bill.finalized_at,

      customerName:
        bill.customer_name,

      paymentMode:
        bill.payment_mode,

      paymentReference:
        bill.payment_reference,

      items: items.map(
        (item) => ({
          name:
            item.product_name,

          quantity:
            Number(item.quantity),

          unit:
            item.unit,

          unitPrice:
            paiseToRupees(
              Number(
                item.unit_price_paise
              )
            ),

          taxable:
            paiseToRupees(
              Number(
                item.taxable_paise
              )
            ),

          gstRate:
            Number(
              item.gst_rate
            ),

          hsnCode:
            item.hsn_code,

          cgst:
            paiseToRupees(
              Number(
                item.cgst_paise
              )
            ),

          sgst:
            paiseToRupees(
              Number(
                item.sgst_paise
              )
            ),

          tax:
            paiseToRupees(
              Number(
                item.tax_paise
              )
            ),

          total:
            paiseToRupees(
              Number(
                item.total_paise
              )
            ),
        })
      ),

      subtotal:
        paiseToRupees(
          Number(
            bill.subtotal_paise
          )
        ),

      cgst:
        paiseToRupees(
          Number(
            bill.cgst_paise
          )
        ),

      sgst:
        paiseToRupees(
          Number(
            bill.sgst_paise
          )
        ),

      tax:
        paiseToRupees(
          Number(
            bill.tax_paise
          )
        ),

      total:
        paiseToRupees(
          Number(
            bill.total_paise
          )
        ),
    });

    return {
      success: true,

      artifactPath:
        outputPath,

      billNumber:
        bill.bill_number,

      message:
        `GST invoice ${bill.bill_number} generated successfully.`,
    };
  },
});

/* =========================================================
   EXPORTED BILLING TOOLS
   ========================================================= */

export const billingTools = {
  create_bill: createBill,
  get_draft_bill: getDraftBill,
  edit_bill: editBill,
  finalize_bill: finalizeBill,
  get_bill: getBill,
  generate_invoice_pdf: generateInvoice,
};