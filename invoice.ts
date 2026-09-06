import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";


type InvoiceItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxable: number;
  gstRate: number;
  hsnCode: string;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
};


type InvoiceOptions = {
  outputPath: string;

  shopName: string;
  shopGSTIN: string;

  billNumber: string;

  createdAt?: string;
  finalizedAt?: string;

  customerName?: string;

  paymentMode?: string;
  paymentReference?: string;

  items: InvoiceItem[];

  subtotal: number;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
};


function money(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}


export async function generateInvoicePdf(
  options: InvoiceOptions
): Promise<string> {

  const outputDir =
    path.dirname(
      options.outputPath
    );

  fs.mkdirSync(
    outputDir,
    {
      recursive: true,
    }
  );


  return new Promise(
    (resolve, reject) => {

      const doc =
        new PDFDocument({
          size: "A4",
          margin: 40,
        });


      const stream =
        fs.createWriteStream(
          options.outputPath
        );


      stream.on(
        "finish",
        () => {
          resolve(
            options.outputPath
          );
        }
      );


      stream.on(
        "error",
        reject
      );


      doc.pipe(stream);


      /* =====================================================
         HEADER
      ===================================================== */

      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .text(
          options.shopName,
          {
            align: "center",
          }
        );

      doc.moveDown(0.3);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `GSTIN: ${
            options.shopGSTIN || "N/A"
          }`,
          {
            align: "center",
          }
        );


      doc.moveDown(1);


      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(
          "TAX INVOICE",
          {
            align: "center",
          }
        );


      doc.moveDown(1);


      /* =====================================================
         BILL DETAILS
      ===================================================== */

      doc
        .fontSize(10)
        .font("Helvetica");

      doc.text(
        `Invoice No: ${options.billNumber}`
      );

      doc.text(
        `Date: ${
          options.finalizedAt ??
          options.createdAt ??
          new Date().toISOString()
        }`
      );

      doc.text(
        `Customer: ${
          options.customerName ||
          "Walk-in Customer"
        }`
      );

      doc.text(
        `Payment: ${
          options.paymentMode ||
          "N/A"
        }`
      );

      if (
        options.paymentReference
      ) {
        doc.text(
          `Reference: ${options.paymentReference}`
        );
      }


      doc.moveDown(1);


      /* =====================================================
         TABLE HEADER
      ===================================================== */

      const startX = 40;

      let y =
        doc.y;

      doc
        .font("Helvetica-Bold")
        .fontSize(9);

      doc.text(
        "Item",
        startX,
        y,
        {
          width: 145,
        }
      );

      doc.text(
        "HSN",
        startX + 145,
        y,
        {
          width: 50,
        }
      );

      doc.text(
        "Qty",
        startX + 195,
        y,
        {
          width: 45,
        }
      );

      doc.text(
        "Rate",
        startX + 240,
        y,
        {
          width: 60,
        }
      );

      doc.text(
        "GST",
        startX + 300,
        y,
        {
          width: 50,
        }
      );

      doc.text(
        "Total",
        startX + 350,
        y,
        {
          width: 90,
          align: "right",
        }
      );


      y += 20;

      doc
        .moveTo(
          startX,
          y - 5
        )
        .lineTo(
          555,
          y - 5
        )
        .stroke();


      /* =====================================================
         ITEMS
      ===================================================== */

      doc
        .font("Helvetica")
        .fontSize(8);


      for (
        const item of options.items
      ) {

        if (y > 700) {
          doc.addPage();
          y = 50;
        }


        doc.text(
          item.name,
          startX,
          y,
          {
            width: 145,
          }
        );

        doc.text(
          item.hsnCode || "-",
          startX + 145,
          y,
          {
            width: 50,
          }
        );

        doc.text(
          `${item.quantity} ${item.unit}`,
          startX + 195,
          y,
          {
            width: 45,
          }
        );

        doc.text(
          money(
            item.unitPrice
          ),
          startX + 240,
          y,
          {
            width: 60,
          }
        );

        doc.text(
          `${item.gstRate}%`,
          startX + 300,
          y,
          {
            width: 50,
          }
        );

        doc.text(
          money(
            item.total
          ),
          startX + 350,
          y,
          {
            width: 90,
            align: "right",
          }
        );


        y += 25;
      }


      /* =====================================================
         TOTALS
      ===================================================== */

      y += 10;


      doc
        .moveTo(
          350,
          y
        )
        .lineTo(
          555,
          y
        )
        .stroke();


      y += 15;


      doc
        .fontSize(10)
        .font("Helvetica");


      doc.text(
        "Subtotal:",
        370,
        y,
        {
          width: 90,
        }
      );

      doc.text(
        money(
          options.subtotal
        ),
        460,
        y,
        {
          width: 95,
          align: "right",
        }
      );


      y += 18;


      doc.text(
        "CGST:",
        370,
        y,
        {
          width: 90,
        }
      );

      doc.text(
        money(
          options.cgst
        ),
        460,
        y,
        {
          width: 95,
          align: "right",
        }
      );


      y += 18;


      doc.text(
        "SGST:",
        370,
        y,
        {
          width: 90,
        }
      );

      doc.text(
        money(
          options.sgst
        ),
        460,
        y,
        {
          width: 95,
          align: "right",
        }
      );


      y += 18;


      doc
        .font("Helvetica-Bold")
        .fontSize(12);

      doc.text(
        "Grand Total:",
        370,
        y,
        {
          width: 90,
        }
      );

      doc.text(
        money(
          options.total
        ),
        460,
        y,
        {
          width: 95,
          align: "right",
        }
      );


      /* =====================================================
         FOOTER
      ===================================================== */

      doc.moveDown(4);

      doc
        .font("Helvetica")
        .fontSize(9)
        .text(
          "Thank you for shopping with us!",
          {
            align: "center",
          }
        );

      doc.moveDown(0.5);

      doc.text(
        "Computer-generated invoice.",
        {
          align: "center",
        }
      );


      doc.end();
    }
  );
}