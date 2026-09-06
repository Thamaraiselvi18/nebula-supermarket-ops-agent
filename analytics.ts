import { z } from "zod";
import path from "node:path";

import { db, transaction } from "../db/schema.js";
import {
  generateAnalysisDeck,
  type AnalysisDeckInput,
} from "../artifacts/deck.js";

function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

function getDateRange(
  from?: string,
  to?: string
): {
  from: string;
  to: string;
} {
  const now = new Date();

  const today = now.toISOString().slice(0, 10);

  return {
    from: from || today,
    to: to || today,
  };
}

export const analyticsTools = {
  // =========================================================
  // DAILY CLOSE
  // =========================================================

  daily_close: {
    description:
      "Close or summarize the shop for a business day. Shows completed bills, sales, GST, payment breakdown and estimated profit.",

    inputSchema: z.object({
      date: z
        .string()
        .optional()
        .describe("Business date in YYYY-MM-DD format"),
    }),

    execute: async ({
      date,
    }: {
      date?: string;
    }) => {
      const businessDate =
        date || new Date().toISOString().slice(0, 10);

      const sales = db
        .prepare(`
          SELECT
            COUNT(*) AS total_bills,
            COALESCE(SUM(subtotal_paise), 0) AS subtotal_paise,
            COALESCE(SUM(cgst_paise), 0) AS cgst_paise,
            COALESCE(SUM(sgst_paise), 0) AS sgst_paise,
            COALESCE(SUM(tax_paise), 0) AS tax_paise,
            COALESCE(SUM(total_paise), 0) AS total_paise
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) = ?
        `)
        .get(businessDate) as {
        total_bills: number;
        subtotal_paise: number;
        cgst_paise: number;
        sgst_paise: number;
        tax_paise: number;
        total_paise: number;
      };

      const payments = db
        .prepare(`
          SELECT
            COALESCE(payment_mode, 'UNKNOWN') AS mode,
            COALESCE(SUM(total_paise), 0) AS amount_paise,
            COUNT(*) AS bill_count
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) = ?
          GROUP BY payment_mode
          ORDER BY amount_paise DESC
        `)
        .all(businessDate) as {
        mode: string;
        amount_paise: number;
        bill_count: number;
      }[];

      const profit = db
        .prepare(`
          SELECT
            COALESCE(
              SUM(
                bi.total_paise -
                (bi.cost_price_paise * bi.quantity)
              ),
              0
            ) AS profit_paise
          FROM bill_items bi
          JOIN bills b ON b.id = bi.bill_id
          WHERE b.status = 'FINALIZED'
            AND DATE(b.finalized_at) = ?
        `)
        .get(businessDate) as {
        profit_paise: number;
      };

      return {
        date: businessDate,

        bills: sales.total_bills,

        subtotal: paiseToRupees(
          sales.subtotal_paise
        ),

        cgst: paiseToRupees(
          sales.cgst_paise
        ),

        sgst: paiseToRupees(
          sales.sgst_paise
        ),

        tax: paiseToRupees(
          sales.tax_paise
        ),

        totalSales: paiseToRupees(
          sales.total_paise
        ),

        estimatedProfit: paiseToRupees(
          profit.profit_paise
        ),

        payments: payments.map((payment) => ({
          mode: payment.mode,
          bills: payment.bill_count,
          amount: paiseToRupees(
            payment.amount_paise
          ),
        })),
      };
    },
  },

  // =========================================================
  // SALES ANALYSIS
  // =========================================================

  sales_analysis: {
    description:
      "Analyze sales for a date range, including total sales, tax, profit, payment modes, top-selling products and low-stock products.",

    inputSchema: z.object({
      from: z
        .string()
        .optional()
        .describe("Start date YYYY-MM-DD"),

      to: z
        .string()
        .optional()
        .describe("End date YYYY-MM-DD"),
    }),

    execute: async ({
      from,
      to,
    }: {
      from?: string;
      to?: string;
    }) => {
      const range = getDateRange(from, to);

      const summary = db
        .prepare(`
          SELECT
            COUNT(*) AS total_bills,
            COALESCE(SUM(subtotal_paise), 0) AS subtotal_paise,
            COALESCE(SUM(cgst_paise), 0) AS cgst_paise,
            COALESCE(SUM(sgst_paise), 0) AS sgst_paise,
            COALESCE(SUM(tax_paise), 0) AS tax_paise,
            COALESCE(SUM(total_paise), 0) AS total_paise
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) >= ?
            AND DATE(finalized_at) <= ?
        `)
        .get(range.from, range.to) as {
        total_bills: number;
        subtotal_paise: number;
        cgst_paise: number;
        sgst_paise: number;
        tax_paise: number;
        total_paise: number;
      };

      // -----------------------------------------------------
      // Profit
      // -----------------------------------------------------

      const profit = db
        .prepare(`
          SELECT
            COALESCE(
              SUM(
                bi.total_paise -
                CAST(bi.cost_price_paise * bi.quantity AS INTEGER)
              ),
              0
            ) AS profit_paise
          FROM bill_items bi
          JOIN bills b ON b.id = bi.bill_id
          WHERE b.status = 'FINALIZED'
            AND DATE(b.finalized_at) >= ?
            AND DATE(b.finalized_at) <= ?
        `)
        .get(range.from, range.to) as {
        profit_paise: number;
      };

      // -----------------------------------------------------
      // Payment breakdown
      // -----------------------------------------------------

      const paymentRows = db
        .prepare(`
          SELECT
            COALESCE(payment_mode, 'UNKNOWN') AS mode,
            COALESCE(SUM(total_paise), 0) AS amount_paise
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) >= ?
            AND DATE(finalized_at) <= ?
          GROUP BY payment_mode
          ORDER BY amount_paise DESC
        `)
        .all(range.from, range.to) as {
        mode: string;
        amount_paise: number;
      }[];

      // -----------------------------------------------------
      // Top selling products
      // -----------------------------------------------------

      const topItems = db
        .prepare(`
          SELECT
            bi.product_name AS name,
            COALESCE(SUM(bi.quantity), 0) AS quantity,
            COALESCE(SUM(bi.total_paise), 0) AS revenue_paise
          FROM bill_items bi
          JOIN bills b ON b.id = bi.bill_id
          WHERE b.status = 'FINALIZED'
            AND DATE(b.finalized_at) >= ?
            AND DATE(b.finalized_at) <= ?
          GROUP BY bi.product_id, bi.product_name
          ORDER BY revenue_paise DESC
          LIMIT 10
        `)
        .all(range.from, range.to) as {
        name: string;
        quantity: number;
        revenue_paise: number;
      }[];

      // -----------------------------------------------------
      // Low stock
      // -----------------------------------------------------

      const lowStock = db
        .prepare(`
          SELECT
            name,
            quantity,
            reorder_level,
            unit
          FROM products
          WHERE active = 1
            AND quantity <= reorder_level
          ORDER BY quantity ASC, name ASC
        `)
        .all() as {
        name: string;
        quantity: number;
        reorder_level: number;
        unit: string;
      }[];

      return {
        from: range.from,
        to: range.to,

        totalBills: summary.total_bills,

        subtotal: paiseToRupees(
          summary.subtotal_paise
        ),

        cgst: paiseToRupees(
          summary.cgst_paise
        ),

        sgst: paiseToRupees(
          summary.sgst_paise
        ),

        tax: paiseToRupees(
          summary.tax_paise
        ),

        totalSales: paiseToRupees(
          summary.total_paise
        ),

        estimatedProfit: paiseToRupees(
          profit.profit_paise
        ),

        paymentBreakdown: paymentRows.map(
          (payment) => ({
            mode: payment.mode,
            amount: paiseToRupees(
              payment.amount_paise
            ),
          })
        ),

        topItems: topItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          revenue: paiseToRupees(
            item.revenue_paise
          ),
        })),

        lowStockItems: lowStock.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          reorderLevel: item.reorder_level,
          unit: item.unit,
        })),
      };
    },
  },

  // =========================================================
  // GENERATE ANALYSIS DECK
  // =========================================================

  generate_analysis_deck: {
    description:
      "Generate a real PPTX business analysis deck for the selected sales period.",

    inputSchema: z.object({
      from: z
        .string()
        .optional()
        .describe("Start date YYYY-MM-DD"),

      to: z
        .string()
        .optional()
        .describe("End date YYYY-MM-DD"),
    }),

    execute: async ({
      from,
      to,
    }: {
      from?: string;
      to?: string;
    }) => {
      const range = getDateRange(from, to);

      // -----------------------------------------------------
      // Summary
      // -----------------------------------------------------

      const summary = db
        .prepare(`
          SELECT
            COUNT(*) AS total_bills,
            COALESCE(SUM(subtotal_paise), 0) AS subtotal_paise,
            COALESCE(SUM(cgst_paise), 0) AS cgst_paise,
            COALESCE(SUM(sgst_paise), 0) AS sgst_paise,
            COALESCE(SUM(tax_paise), 0) AS tax_paise,
            COALESCE(SUM(total_paise), 0) AS total_paise
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) >= ?
            AND DATE(finalized_at) <= ?
        `)
        .get(range.from, range.to) as {
        total_bills: number;
        subtotal_paise: number;
        cgst_paise: number;
        sgst_paise: number;
        tax_paise: number;
        total_paise: number;
      };

      // -----------------------------------------------------
      // Profit
      // -----------------------------------------------------

      const profit = db
        .prepare(`
          SELECT
            COALESCE(
              SUM(
                bi.total_paise -
                CAST(bi.cost_price_paise * bi.quantity AS INTEGER)
              ),
              0
            ) AS profit_paise
          FROM bill_items bi
          JOIN bills b ON b.id = bi.bill_id
          WHERE b.status = 'FINALIZED'
            AND DATE(b.finalized_at) >= ?
            AND DATE(b.finalized_at) <= ?
        `)
        .get(range.from, range.to) as {
        profit_paise: number;
      };

      // -----------------------------------------------------
      // Payments
      // -----------------------------------------------------

      const payments = db
        .prepare(`
          SELECT
            COALESCE(payment_mode, 'UNKNOWN') AS mode,
            COALESCE(SUM(total_paise), 0) AS amount_paise
          FROM bills
          WHERE status = 'FINALIZED'
            AND DATE(finalized_at) >= ?
            AND DATE(finalized_at) <= ?
          GROUP BY payment_mode
          ORDER BY amount_paise DESC
        `)
        .all(range.from, range.to) as {
        mode: string;
        amount_paise: number;
      }[];

      // -----------------------------------------------------
      // Top items
      // -----------------------------------------------------

      const topItems = db
        .prepare(`
          SELECT
            bi.product_name AS name,
            COALESCE(SUM(bi.quantity), 0) AS quantity,
            COALESCE(SUM(bi.total_paise), 0) AS revenue_paise
          FROM bill_items bi
          JOIN bills b ON b.id = bi.bill_id
          WHERE b.status = 'FINALIZED'
            AND DATE(b.finalized_at) >= ?
            AND DATE(b.finalized_at) <= ?
          GROUP BY bi.product_id, bi.product_name
          ORDER BY revenue_paise DESC
          LIMIT 10
        `)
        .all(range.from, range.to) as {
        name: string;
        quantity: number;
        revenue_paise: number;
      }[];

      // -----------------------------------------------------
      // Low stock
      // -----------------------------------------------------

      const lowStock = db
        .prepare(`
          SELECT
            name,
            quantity,
            reorder_level,
            unit
          FROM products
          WHERE active = 1
            AND quantity <= reorder_level
          ORDER BY quantity ASC, name ASC
        `)
        .all() as {
        name: string;
        quantity: number;
        reorder_level: number;
        unit: string;
      }[];

      const outputPath = path.resolve(
        process.cwd(),
        "data",
        `sales-analysis-${range.from}-to-${range.to}.pptx`
      );

      const deckInput: AnalysisDeckInput = {
        outputPath,

        shopName:
          process.env.SHOP_NAME ||
          "Nebula Kirana",

        from: range.from,
        to: range.to,

        totalBills: summary.total_bills,

        totalSalesPaise:
          summary.total_paise,

        totalTaxPaise:
          summary.tax_paise,

        totalProfitPaise:
          profit.profit_paise,

        paymentBreakdown:
          payments.map((payment) => ({
            mode: payment.mode,
            amountPaise:
              payment.amount_paise,
          })),

        topItems:
          topItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            revenuePaise:
              item.revenue_paise,
          })),

        lowStockItems:
          lowStock.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            reorderLevel:
              item.reorder_level,
            unit: item.unit,
          })),
      };

      await generateAnalysisDeck(deckInput);

      return {
        success: true,

        message:
          `Sales analysis deck generated for ${range.from} to ${range.to}.`,

        artifactPath: outputPath,

        period: {
          from: range.from,
          to: range.to,
        },

        totalSales: paiseToRupees(
          summary.total_paise
        ),

        totalBills:
          summary.total_bills,
      };
    },
  },
};