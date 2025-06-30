import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import { renderInvoiceHTML } from "./renderInvoice.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.DOMAIN || "http://localhost:3000"
}));
app.use(bodyParser.json());

app.post("/generate-invoice", async (req, res) => {
    try {
        const invoiceData = req.body;
        const html = renderInvoiceHTML(invoiceData);

        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--single-process",
                "--disable-gpu"
            ]
        });

        const page = await browser.newPage();

        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1
        });

        await page.setContent(html, {
            waitUntil: ["networkidle0", "domcontentloaded"],
            timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for render

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "15mm",
                bottom: "15mm",
                left: "10mm",
                right: "10mm"
            },
            displayHeaderFooter: false,
            preferCSSPageSize: false,
            scale: 1.0
        });

        await browser.close();

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=invoice.pdf"
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`PDF Generator is running on http://localhost:${PORT}`);
});
