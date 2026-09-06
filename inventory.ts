import { tool } from "ai";
import { z } from "zod";

import {
  db,
  transaction,
  normalizeName,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
} from "../db/schema.js";


/* =========================================================
   SEARCH PRODUCTS
========================================================= */

const searchProducts = tool({
  description: `
Search supermarket products by name.

Use this before billing whenever the product is not already
unambiguously identified.

Never guess between multiple matching products.
  `,

  inputSchema: z.object({
    query: z.string().min(1),
  }),

  execute: async ({ query }) => {

    const normalized =
      normalizeName(query);

    const exact =
      db.prepare(`
        SELECT
          id,
          name,
          unit,
          quantity,
          reorder_level,
          cost_price_paise,
          sell_price_paise,
          mrp_paise,
          gst_rate,
          hsn_code,
          active
        FROM products
        WHERE
          normalized_name = ?
          AND active = 1
        LIMIT 1
      `).get(normalized) as any;

    if (exact) {
      return {
        success: true,
        exactMatch: true,
        products: [
          {
            id: exact.id,
            name: exact.name,
            unit: exact.unit,
            quantity: exact.quantity,
            reorderLevel:
              exact.reorder_level,
            costPrice:
              paiseToRupees(
                exact.cost_price_paise
              ),
            sellingPrice:
              paiseToRupees(
                exact.sell_price_paise
              ),
            mrp:
              paiseToRupees(
                exact.mrp_paise
              ),
            gstRate:
              exact.gst_rate,
            hsnCode:
              exact.hsn_code,
          },
        ],
      };
    }


    const products =
      db.prepare(`
        SELECT
          id,
          name,
          unit,
          quantity,
          reorder_level,
          cost_price_paise,
          sell_price_paise,
          mrp_paise,
          gst_rate,
          hsn_code,
          active
        FROM products
        WHERE
          active = 1
          AND (
            normalized_name LIKE ?
            OR name LIKE ?
          )
        ORDER BY name
        LIMIT 20
      `).all(
        `%${normalized}%`,
        `%${query.trim()}%`
      ) as any[];


    return {
      success: true,
      exactMatch: false,

      products:
        products.map(
          (product) => ({
            id: product.id,
            name: product.name,
            unit: product.unit,
            quantity:
              product.quantity,
            reorderLevel:
              product.reorder_level,
            costPrice:
              paiseToRupees(
                product.cost_price_paise
              ),
            sellingPrice:
              paiseToRupees(
                product.sell_price_paise
              ),
            mrp:
              paiseToRupees(
                product.mrp_paise
              ),
            gstRate:
              product.gst_rate,
            hsnCode:
              product.hsn_code,
          })
        ),
    };
  },
});


/* =========================================================
   GET STOCK
========================================================= */

const getStock = tool({
  description: `
Get current stock for one product or all products.

Use this for:
- stock queries
- inventory checks
- "how much Maggi is there?"
- "show all products"
  `,

  inputSchema: z.object({
    productName:
      z.string()
        .optional(),

    productId:
      z.number()
        .int()
        .positive()
        .optional(),

    lowStockOnly:
      z.boolean()
        .optional()
        .default(false),
  }),

  execute: async ({
    productName,
    productId,
    lowStockOnly,
  }) => {

    let rows: any[];

    if (productId !== undefined) {

      rows =
        db.prepare(`
          SELECT
            id,
            name,
            unit,
            quantity,
            reorder_level,
            sell_price_paise,
            mrp_paise,
            gst_rate,
            hsn_code
          FROM products
          WHERE id = ?
            AND active = 1
        `).all(
          productId
        ) as any[];

    } else if (productName) {

      const normalized =
        normalizeName(
          productName
        );

      rows =
        db.prepare(`
          SELECT
            id,
            name,
            unit,
            quantity,
            reorder_level,
            sell_price_paise,
            mrp_paise,
            gst_rate,
            hsn_code
          FROM products
          WHERE
            active = 1
            AND (
              normalized_name = ?
              OR normalized_name LIKE ?
              OR name LIKE ?
            )
        `).all(
          normalized,
          `%${normalized}%`,
          `%${productName.trim()}%`
        ) as any[];

    } else if (lowStockOnly) {

      rows =
        db.prepare(`
          SELECT
            id,
            name,
            unit,
            quantity,
            reorder_level,
            sell_price_paise,
            mrp_paise,
            gst_rate,
            hsn_code
          FROM products
          WHERE
            active = 1
            AND quantity <= reorder_level
          ORDER BY
            quantity ASC,
            name ASC
        `).all() as any[];

    } else {

      rows =
        db.prepare(`
          SELECT
            id,
            name,
            unit,
            quantity,
            reorder_level,
            sell_price_paise,
            mrp_paise,
            gst_rate,
            hsn_code
          FROM products
          WHERE active = 1
          ORDER BY name ASC
        `).all() as any[];
    }


    return {
      success: true,

      count: rows.length,

      products:
        rows.map(
          (product) => ({
            id: product.id,
            name: product.name,
            quantity:
              product.quantity,
            unit:
              product.unit,
            reorderLevel:
              product.reorder_level,

            lowStock:
              Number(product.quantity) <=
              Number(product.reorder_level),

            sellingPrice:
              paiseToRupees(
                product.sell_price_paise
              ),

            mrp:
              paiseToRupees(
                product.mrp_paise
              ),

            gstRate:
              product.gst_rate,

            hsnCode:
              product.hsn_code,
          })
        ),
    };
  },
});


/* =========================================================
   LOW STOCK
========================================================= */

const getLowStock = tool({
  description: `
Find products whose current quantity is at or below
their configured reorder level.

Use this for low-stock and reorder questions.
  `,

  inputSchema: z.object({}),

  execute: async () => {

    const products =
      db.prepare(`
        SELECT
          id,
          name,
          unit,
          quantity,
          reorder_level,
          sell_price_paise
        FROM products
        WHERE
          active = 1
          AND quantity <= reorder_level
        ORDER BY
          quantity ASC,
          name ASC
      `).all() as any[];


    return {
      success: true,

      count:
        products.length,

      products:
        products.map(
          (product) => ({
            id:
              product.id,

            name:
              product.name,

            quantity:
              product.quantity,

            unit:
              product.unit,

            reorderLevel:
              product.reorder_level,

            shortage:
              Math.max(
                0,
                Number(
                  product.reorder_level
                ) -
                Number(
                  product.quantity
                )
              ),

            sellingPrice:
              paiseToRupees(
                product.sell_price_paise
              ),
          })
        ),
    };
  },
});


/* =========================================================
   ADD PRODUCT
========================================================= */

const addProduct = tool({
  description: `
Add a new supermarket product to inventory.

Required:
- product name
- unit
- cost price
- selling price
- MRP
- GST rate
- HSN code
- initial stock
- reorder level

Do not create duplicate products.
Do not allow selling price below cost price.
  `,

  inputSchema: z.object({

    name:
      z.string()
        .min(1),

    unit:
      z.enum([
        "kg",
        "g",
        "litre",
        "ml",
        "packet",
        "dozen",
        "piece",
      ]),

    costPrice:
      z.number()
        .nonnegative(),

    sellPrice:
      z.number()
        .nonnegative(),

    mrp:
      z.number()
        .nonnegative(),

    gstRate:
      z.number()
        .min(0)
        .max(100),

    hsnCode:
      z.string()
        .min(1),

    quantity:
      z.number()
        .nonnegative(),

    reorderLevel:
      z.number()
        .nonnegative(),
  }),

  execute: async ({
    name,
    unit,
    costPrice,
    sellPrice,
    mrp,
    gstRate,
    hsnCode,
    quantity,
    reorderLevel,
  }) => {

    return transaction(() => {

      const normalizedName =
        normalizeName(name);


      /*
       * Guard: selling below cost.
       */
      if (
        sellPrice < costPrice
      ) {
        throw new Error(
          `Selling price ₹${sellPrice} cannot be below cost price ₹${costPrice}.`
        );
      }


      /*
       * Guard: selling price cannot exceed MRP
       * for this supermarket implementation.
       */
      if (
        sellPrice > mrp
      ) {
        throw new Error(
          `Selling price ₹${sellPrice} cannot be greater than MRP ₹${mrp}.`
        );
      }


      /*
       * Prevent duplicate product.
       */
      const existing =
        db.prepare(`
          SELECT id, name
          FROM products
          WHERE normalized_name = ?
          LIMIT 1
        `).get(
          normalizedName
        ) as any;

      if (existing) {
        throw new Error(
          `Product "${existing.name}" already exists in inventory.`
        );
      }


      const costPricePaise =
        rupeesToPaise(
          costPrice
        );

      const sellPricePaise =
        rupeesToPaise(
          sellPrice
        );

      const mrpPaise =
        rupeesToPaise(
          mrp
        );


      const result =
        db.prepare(`
          INSERT INTO products (
            name,
            normalized_name,
            unit,
            cost_price_paise,
            sell_price_paise,
            mrp_paise,
            quantity,
            reorder_level,
            gst_rate,
            hsn_code,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          name.trim(),
          normalizedName,
          unit,
          costPricePaise,
          sellPricePaise,
          mrpPaise,
          quantity,
          reorderLevel,
          gstRate,
          hsnCode.trim()
        );


      const productId =
        Number(
          result.lastInsertRowid
        );


      /*
       * Record initial stock.
       */
      if (quantity > 0) {

        db.prepare(`
          INSERT INTO stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            note
          )
          VALUES (?, 'RECEIVE', ?, 'PRODUCT', ?, ?)
        `).run(
          productId,
          quantity,
          productId,
          "Initial stock"
        );
      }


      return {
        success: true,

        product: {
          id:
            productId,

          name:
            name.trim(),

          unit,

          quantity,

          reorderLevel,

          costPrice:
            formatINR(
              costPricePaise
            ),

          sellingPrice:
            formatINR(
              sellPricePaise
            ),

          mrp:
            formatINR(
              mrpPaise
            ),

          gstRate,

          hsnCode:
            hsnCode.trim(),
        },

        message:
          `Product "${name.trim()}" added successfully.`,
      };
    });
  },
});


/* =========================================================
   RECEIVE STOCK
========================================================= */

const receiveStock = tool({
  description: `
Receive new stock into inventory.

Use this when the shop owner says things like:
- received 20 Maggi
- add 10kg sugar
- supplier delivered 30 Tata Salt
- stock inward

Receiving stock INCREASES inventory.

The operation is transactional and records a stock movement.
  `,

  inputSchema: z.object({

    productName:
      z.string()
        .optional(),

    productId:
      z.number()
        .int()
        .positive()
        .optional(),

    quantity:
      z.number()
        .positive(),

    costPrice:
      z.number()
        .nonnegative()
        .optional(),

    note:
      z.string()
        .optional(),
  }).refine(
    (value) =>
      value.productId !== undefined ||
      value.productName !== undefined,
    {
      message:
        "Provide productId or productName.",
    }
  ),

  execute: async ({
    productName,
    productId,
    quantity,
    costPrice,
    note,
  }) => {

    return transaction(() => {

      let product: any;


      if (
        productId !== undefined
      ) {

        product =
          db.prepare(`
            SELECT *
            FROM products
            WHERE
              id = ?
              AND active = 1
            LIMIT 1
          `).get(
            productId
          );

      } else {

        const normalized =
          normalizeName(
            productName!
          );

        const exact =
          db.prepare(`
            SELECT *
            FROM products
            WHERE
              normalized_name = ?
              AND active = 1
            LIMIT 1
          `).get(
            normalized
          ) as any;

        if (exact) {

          product = exact;

        } else {

          const candidates =
            db.prepare(`
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
            `).all(
              `%${normalized}%`,
              `%${productName!.trim()}%`
            ) as any[];


          if (
            candidates.length > 1
          ) {
            throw new Error(
              `Product "${productName}" is ambiguous. Please choose one: ${
                candidates
                  .map(
                    (p) => p.name
                  )
                  .join(", ")
              }`
            );
          }


          if (
            candidates.length === 1
          ) {
            product =
              candidates[0];
          }
        }
      }


      if (!product) {
        throw new Error(
          `Product "${productName ?? productId}" was not found.`
        );
      }


      /*
       * Optional supplier cost update.
       */
      if (
        costPrice !== undefined
      ) {

        const costPaise =
          rupeesToPaise(
            costPrice
          );

        if (
          product.sell_price_paise <
          costPaise
        ) {
          throw new Error(
            `New cost ₹${costPrice} is greater than the current selling price ₹${paiseToRupees(product.sell_price_paise)}. Update the selling price before receiving this stock.`
          );
        }


        db.prepare(`
          UPDATE products
          SET
            cost_price_paise = ?,
            quantity = quantity + ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND active = 1
        `).run(
          costPaise,
          quantity,
          product.id
        );

      } else {

        db.prepare(`
          UPDATE products
          SET
            quantity = quantity + ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND active = 1
        `).run(
          quantity,
          product.id
        );
      }


      /*
       * Record stock movement.
       */
      db.prepare(`
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          note
        )
        VALUES (?, 'RECEIVE', ?, 'MANUAL', NULL, ?)
      `).run(
        product.id,
        quantity,
        note ??
          "Stock received"
      );


      const updated =
        db.prepare(`
          SELECT
            id,
            name,
            unit,
            quantity,
            reorder_level,
            cost_price_paise,
            sell_price_paise,
            mrp_paise
          FROM products
          WHERE id = ?
        `).get(
          product.id
        ) as any;


      return {
        success: true,

        product: {
          id:
            updated.id,

          name:
            updated.name,

          unit:
            updated.unit,

          receivedQuantity:
            quantity,

          currentQuantity:
            updated.quantity,

          reorderLevel:
            updated.reorder_level,

          costPrice:
            formatINR(
              updated.cost_price_paise
            ),

          sellingPrice:
            formatINR(
              updated.sell_price_paise
            ),

          mrp:
            formatINR(
              updated.mrp_paise
            ),
        },

        message:
          `Received ${quantity} ${updated.unit} of ${updated.name}. Current stock is ${updated.quantity} ${updated.unit}.`,
      };
    });
  },
});


/* =========================================================
   EXPORT
========================================================= */

export const inventoryTools = {
  search_products:
    searchProducts,

  get_stock:
    getStock,

  get_low_stock:
    getLowStock,

  add_product:
    addProduct,

  receive_stock:
    receiveStock,
};