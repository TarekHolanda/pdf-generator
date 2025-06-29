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

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        render: !!process.env.RENDER
    });
});

app.post("/generate-invoice", async (req, res) => {
    let browser;
    try {
        console.log("Received invoice generation request");
        const invoiceData = req.body;
        const html = renderInvoiceHTML(invoiceData);

        // Configure Puppeteer for cloud deployment
        const launchOptions = {
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
                "--disable-features=VizDisplayCompositor",
                "--disable-extensions",
                "--disable-plugins",
                "--disable-images",
                "--disable-javascript",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding"
            ]
        };

        console.log("Launching browser with options:", launchOptions);
        
        try {
            browser = await puppeteer.launch(launchOptions);
            console.log("Browser launched successfully");
        } catch (launchError) {
            console.error("Failed to launch browser:", launchError.message);
            
            // Try with minimal options
            console.log("Retrying with minimal options...");
            const minimalOptions = {
                headless: "new",
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            };
            browser = await puppeteer.launch(minimalOptions);
            console.log("Browser launched successfully with minimal options");
        }

        const page = await browser.newPage();
        console.log("New page created");

        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1
        });

        console.log("Setting page content...");
        await page.setContent(html, {
            waitUntil: ["networkidle0", "domcontentloaded"],
            timeout: 30000
        });

        console.log("Waiting for render...");
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for render

        console.log("Generating PDF...");
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

        console.log("PDF generated successfully, size:", pdfBuffer.length, "bytes");

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=invoice.pdf"
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error generating PDF:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            error: "Internal Server Error",
            details: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log("Browser closed successfully");
            } catch (closeError) {
                console.error("Error closing browser:", closeError);
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`PDF Generator is running on http://localhost:${PORT}`);
});
