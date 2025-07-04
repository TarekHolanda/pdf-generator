#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderInvoiceHTML } from "./src/renderInvoice.js";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePDF(data) {
    const html = renderInvoiceHTML(data);

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

    await new Promise(resolve => setTimeout(resolve, 1000));

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
    return pdfBuffer;
}

// CLI usage
if (process.argv.length === 4) {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3];

    const json = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    generatePDF(json)
        .then(buffer => {
            fs.writeFileSync(outputPath, buffer);
            console.log(`✅ Invoice PDF generated at ${outputPath}`);
        })
        .catch(err => {
            console.error("❌ Error generating PDF:", err);
            process.exit(1);
        });
}
