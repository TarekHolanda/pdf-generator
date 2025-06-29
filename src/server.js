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

// Helper function to find Chrome executable
const findChromeExecutable = () => {
    const possiblePaths = [
        "/opt/render/.cache/puppeteer/chrome-linux/chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium"
    ];
    
    // For now, return the Render path if we're on Render
    if (process.env.RENDER) {
        return "/opt/render/.cache/puppeteer/chrome-linux/chrome";
    }
    
    return null; // Let Puppeteer find it automatically
};

app.post("/generate-invoice", async (req, res) => {
    let browser;
    try {
        console.log("Received invoice generation request");
        const invoiceData = req.body;
        const html = renderInvoiceHTML(invoiceData);

        // Configure Puppeteer for Render deployment
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
                "--disable-features=VizDisplayCompositor"
            ]
        };

        // Set Chrome executable path if available
        const chromePath = findChromeExecutable();
        if (chromePath) {
            launchOptions.executablePath = chromePath;
            console.log("Using Chrome executable path:", chromePath);
        } else {
            console.log("Using default Chrome executable path");
        }

        console.log("Launching browser with options:", launchOptions);
        browser = await puppeteer.launch(launchOptions);
        console.log("Browser launched successfully");

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
