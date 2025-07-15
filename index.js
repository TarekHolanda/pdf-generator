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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ? process.env.PUPPETEER_EXECUTABLE_PATH : "/app/.apt/usr/bin/google-chrome",
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor"
        ]
    });

    const page = await browser.newPage();

    // Disable network requests to prevent timeouts
    await page.setRequestInterception(true);
    page.on("request", (request) => {
        if (request.resourceType() === "image") {
            request.abort();
        } else {
            request.continue();
        }
    });

    await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1
    });

    await page.setContent(html, {
        waitUntil: ["domcontentloaded"],
        timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

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
