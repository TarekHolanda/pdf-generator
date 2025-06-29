import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import { renderInvoiceHTML } from "./renderInvoice.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.DOMAIN || "http://localhost:3000"
}));
app.use(bodyParser.json());

// Health check endpoint
app.get("/health", (req, res) => {
    try {
        // Check if Chrome is available
        let chromeStatus = "unknown";
        try {
            const chromePath = execSync("which google-chrome", { encoding: "utf8" }).trim();
            chromeStatus = `found at ${chromePath}`;
        } catch (e) {
            chromeStatus = "not found in PATH";
        }

        // Check Puppeteer cache
        let puppeteerCache = "unknown";
        try {
            const cachePath = "/opt/render/.cache/puppeteer";
            if (fs.existsSync(cachePath)) {
                const files = fs.readdirSync(cachePath);
                puppeteerCache = `exists with ${files.length} items: ${files.join(", ")}`;
            } else {
                puppeteerCache = "does not exist";
            }
        } catch (e) {
            puppeteerCache = `error checking: ${e.message}`;
        }

        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development",
            render: !!process.env.RENDER,
            chrome: chromeStatus,
            puppeteerCache: puppeteerCache
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: error.message
        });
    }
});

// Helper function to launch browser with multiple fallback strategies
const launchBrowser = async () => {
    const strategies = [
        // Strategy 1: Default Puppeteer launch
        {
            name: "Default Puppeteer",
            options: {
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
            }
        },
        // Strategy 2: Minimal options
        {
            name: "Minimal Options",
            options: {
                headless: "new",
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            }
        },
        // Strategy 3: Try with specific executable path
        {
            name: "With Executable Path",
            options: {
                headless: "new",
                executablePath: "/opt/render/.cache/puppeteer/chrome-linux/chrome",
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            }
        },
        // Strategy 4: Try with system Chrome
        {
            name: "System Chrome",
            options: {
                headless: "new",
                executablePath: "/usr/bin/google-chrome",
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            console.log(`Trying strategy: ${strategy.name}`);
            const browser = await puppeteer.launch(strategy.options);
            console.log(`✅ Browser launched successfully with strategy: ${strategy.name}`);
            return browser;
        } catch (error) {
            console.log(`❌ Strategy ${strategy.name} failed:`, error.message);
            continue;
        }
    }

    throw new Error("All browser launch strategies failed");
};

app.post("/generate-invoice", async (req, res) => {
    let browser;
    try {
        console.log("Received invoice generation request");
        const invoiceData = req.body;
        const html = renderInvoiceHTML(invoiceData);

        console.log("Launching browser with multiple strategies...");
        browser = await launchBrowser();

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
