import { tool } from "ai";
import { z } from "zod";

import {
  db,
  transaction,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  normalizeName,
} from "../db/schema.js";


/* =========================================================
   FIND CUSTOMER
========================================================= */

function findCustomer(name: string) {
  const normalized = normalizeName(name);

  return db.prepare(`
    SELECT *
    FROM customers
    WHERE normalized_name = ?
    LIMIT 1
  `).get(normalized) as any;
}


/* =========================================================
   GET BALANCE
========================================================= */

function getCustomerBalance(customerId: number) {
  const row = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN entry_type = 'CREDIT'
            THEN amount_paise
            WHEN entry_type = 'PAYMENT'
            THEN -amount_paise
            ELSE 0
          END
        ),
        0
      ) AS balance_paise
    FROM khata_entries
    WHERE customer_id = ?
  `).get(customerId) as any;

  return Number(row?.balance_paise ?? 0);
}


/* =========================================================
   ADD CREDIT
========================================================= */

const creditAdd = tool({
  description: `
Add a credit/khata entry for a customer.

Use when the shop owner says:
- add 500 to Ramesh khata
- Ramesh took goods on credit
- put this bill on customer's credit

Never allow negative credit.
  `,

  inputSchema: z.object({
    customerName:
      z.string().min(1),

    amount:
      z.number().positive(),

    billId:
      z.number()
        .int()
        .positive()
        .optional(),

    note:
      z.string()
        .optional(),
  }),

  execute: async ({
    customerName,
    amount,
    billId,
    note,
  }) => {

    return transaction(() => {

      let customer =
        findCustomer(
          customerName
        );

      /*
       * Create customer if not present.
       */
      if (!customer) {

        const result =
          db.prepare(`
            INSERT INTO customers (
              name,
              normalized_name
            )
            VALUES (?, ?)
          `).run(
            customerName.trim(),
            normalizeName(
              customerName
            )
          );

        customer =
          db.prepare(`
            SELECT *
            FROM customers
            WHERE id = ?
          `).get(
            Number(
              result.lastInsertRowid
            )
          ) as any;
      }


      const amountPaise =
        rupeesToPaise(amount);


      db.prepare(`
        INSERT INTO khata_entries (
          customer_id,
          entry_type,
          amount_paise,
          bill_id,
          note
        )
        VALUES (?, 'CREDIT', ?, ?, ?)
      `).run(
        customer.id,
        amountPaise,
        billId ?? null,
        note ??
          "Credit sale"
      );


      const balance =
        getCustomerBalance(
          customer.id
        );


      return {
        success: true,

        customer: {
          id:
            customer.id,

          name:
            customer.name,

          addedCredit:
            formatINR(
              amountPaise
            ),

          balance:
            formatINR(
              balance
            ),
        },

        message:
          `${customer.name}'s khata increased by ${formatINR(amountPaise)}. Current balance: ${formatINR(balance)}.`,
      };
    });
  },
});


/* =========================================================
   CREDIT PAYMENT
========================================================= */

const creditPayment = tool({
  description: `
Record a payment made by a customer towards their khata.

Never allow payment greater than the outstanding balance.
  `,

  inputSchema: z.object({
    customerName:
      z.string().min(1),

    amount:
      z.number().positive(),

    paymentMode:
      z.enum([
        "CASH",
        "UPI",
        "CARD",
      ]),

    reference:
      z.string()
        .optional(),

    note:
      z.string()
        .optional(),
  }),

  execute: async ({
    customerName,
    amount,
    paymentMode,
    reference,
    note,
  }) => {

    return transaction(() => {

      const customer =
        findCustomer(
          customerName
        );

      if (!customer) {
        throw new Error(
          `Customer "${customerName}" was not found in khata.`
        );
      }


      const balance =
        getCustomerBalance(
          customer.id
        );


      const paymentPaise =
        rupeesToPaise(amount);


      if (balance <= 0) {
        throw new Error(
          `${customer.name} has no outstanding khata balance.`
        );
      }


      if (
        paymentPaise > balance
      ) {
        throw new Error(
          `Payment of ${formatINR(paymentPaise)} exceeds ${customer.name}'s outstanding balance of ${formatINR(balance)}.`
        );
      }


      if (
        paymentMode !== "CASH" &&
        !reference
      ) {
        throw new Error(
          `${paymentMode} payment requires a payment reference.`
        );
      }


      db.prepare(`
        INSERT INTO khata_entries (
          customer_id,
          entry_type,
          amount_paise,
          payment_mode,
          payment_reference,
          note
        )
        VALUES (?, 'PAYMENT', ?, ?, ?, ?)
      `).run(
        customer.id,
        paymentPaise,
        paymentMode,
        reference ?? null,
        note ??
          "Khata payment"
      );


      const newBalance =
        getCustomerBalance(
          customer.id
        );


      return {
        success: true,

        customer: {
          name:
            customer.name,

          payment:
            formatINR(
              paymentPaise
            ),

          paymentMode,

          previousBalance:
            formatINR(
              balance
            ),

          remainingBalance:
            formatINR(
              newBalance
            ),
        },

        message:
          `${customer.name} paid ${formatINR(paymentPaise)}. Remaining khata balance: ${formatINR(newBalance)}.`,
      };
    });
  },
});


/* =========================================================
   CREDIT BALANCE
========================================================= */

const creditBalance = tool({
  description: `
Show a customer's current khata balance and recent transactions.
  `,

  inputSchema: z.object({
    customerName:
      z.string().min(1),
  }),

  execute: async ({
    customerName,
  }) => {

    const customer =
      findCustomer(
        customerName
      );

    if (!customer) {
      throw new Error(
        `Customer "${customerName}" was not found in khata.`
      );
    }


    const balance =
      getCustomerBalance(
        customer.id
      );


    const entries =
      db.prepare(`
        SELECT
          id,
          entry_type,
          amount_paise,
          payment_mode,
          payment_reference,
          bill_id,
          note,
          created_at
        FROM khata_entries
        WHERE customer_id = ?
        ORDER BY id DESC
        LIMIT 20
      `).all(
        customer.id
      ) as any[];


    return {
      success: true,

      customer: {
        id:
          customer.id,

        name:
          customer.name,

        balance:
          formatINR(
            balance
          ),

        transactions:
          entries.map(
            (entry) => ({
              type:
                entry.entry_type,

              amount:
                formatINR(
                  entry.amount_paise
                ),

              paymentMode:
                entry.payment_mode,

              reference:
                entry.payment_reference,

              billId:
                entry.bill_id,

              note:
                entry.note,

              date:
                entry.created_at,
            })
          ),
      },

      message:
        `${customer.name}'s current khata balance is ${formatINR(balance)}.`,
    };
  },
});


/* =========================================================
   CUSTOMER LIST
========================================================= */

const listCustomers = tool({
  description: `
List customers who have khata activity, with their current
outstanding balances.
  `,

  inputSchema: z.object({}),

  execute: async () => {

    const customers =
      db.prepare(`
        SELECT
          c.id,
          c.name,

          COALESCE(
            SUM(
              CASE
                WHEN k.entry_type = 'CREDIT'
                THEN k.amount_paise

                WHEN k.entry_type = 'PAYMENT'
                THEN -k.amount_paise

                ELSE 0
              END
            ),
            0
          ) AS balance_paise

        FROM customers c

        LEFT JOIN khata_entries k
          ON k.customer_id = c.id

        GROUP BY
          c.id,
          c.name

        HAVING
          balance_paise > 0

        ORDER BY
          balance_paise DESC,
          c.name ASC
      `).all() as any[];


    return {
      success: true,

      customers:
        customers.map(
          (customer) => ({
            id:
              customer.id,

            name:
              customer.name,

            balance:
              formatINR(
                Number(
                  customer.balance_paise
                )
              ),
          })
        ),
    };
  },
});


/* =========================================================
   EXPORT
========================================================= */

export const khataTools = {
  credit_add:
    creditAdd,

  credit_payment:
    creditPayment,

  credit_balance:
    creditBalance,

  list_customers:
    listCustomers,
};