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

// Global variable to track Chrome installation status
let chromeInstallationChecked = false;

app.use(cors({
    origin: process.env.DOMAIN || "http://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
    credentials: true
}));
app.use(bodyParser.json());

// Handle CORS preflight requests
app.options("*", (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Access-Control-Max-Age": "86400"
    });
    res.status(200).end();
});

// Function to install Chrome at runtime if needed
const ensureChromeInstalled = async () => {
    // Only check once per server instance
    if (chromeInstallationChecked) {
        console.log("Chrome installation already checked, skipping...");
        return;
    }
    
    try {
        console.log("Checking if Chrome is installed...");
        
        // Check if Puppeteer cache exists
        const cachePath = "/opt/render/.cache/puppeteer";
        if (!fs.existsSync(cachePath)) {
            console.log("Puppeteer cache not found, installing Chrome...");
            try {
                // Try multiple installation approaches
                const installCommands = [
                    "npx puppeteer browsers install chrome",
                    "PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome",
                    "npx puppeteer browsers install chrome --path /opt/render/.cache/puppeteer"
                ];
                
                let installed = false;
                for (const command of installCommands) {
                    try {
                        console.log(`Trying: ${command}`);
                        execSync(command, { 
                            stdio: "inherit",
                            timeout: 120000 // 2 minutes timeout
                        });
                        console.log("✅ Chrome installed successfully");
                        installed = true;
                        break;
                    } catch (cmdError) {
                        console.log(`❌ Command failed: ${command}`, cmdError.message);
                        continue;
                    }
                }
                
                if (!installed) {
                    throw new Error("All Chrome installation commands failed");
                }
            } catch (installError) {
                console.error("❌ Failed to install Chrome:", installError.message);
                throw installError;
            }
        } else {
            console.log("✅ Puppeteer cache exists");
        }
        
        // Verify installation
        try {
            const browsers = execSync("npx puppeteer browsers list", { encoding: "utf8" });
            console.log("Installed browsers:", browsers);
        } catch (e) {
            console.log("Could not list browsers:", e.message);
        }
        
        chromeInstallationChecked = true;
        
    } catch (error) {
        console.error("Error ensuring Chrome installation:", error);
        chromeInstallationChecked = true; // Mark as checked even if failed
        throw error;
    }
};

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
    // First, ensure Chrome is installed
    await ensureChromeInstalled();
    
    const strategies = [
        // Strategy 1: Default Puppeteer launch (let it find Chrome automatically)
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
        // Strategy 3: Try to find Chrome in common locations
        {
            name: "Find Chrome",
            options: {
                headless: "new",
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            console.log(`Trying strategy: ${strategy.name}`);
            
            // For strategy 3, try to find Chrome executable
            if (strategy.name === "Find Chrome") {
                const possiblePaths = [
                    "/opt/render/.cache/puppeteer/chrome-linux/chrome",
                    "/opt/render/.cache/puppeteer/chrome/chrome",
                    "/usr/bin/google-chrome",
                    "/usr/bin/chromium-browser",
                    "/usr/bin/chromium"
                ];
                
                for (const chromePath of possiblePaths) {
                    if (fs.existsSync(chromePath)) {
                        console.log(`Found Chrome at: ${chromePath}`);
                        strategy.options.executablePath = chromePath;
                        break;
                    }
                }
            }
            
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
        console.log("Request headers:", req.headers);
        console.log("Request body size:", JSON.stringify(req.body).length, "bytes");
        
        const invoiceData = req.body;
        const html = renderInvoiceHTML(invoiceData);
        console.log("Generated HTML size:", html.length, "characters");

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
        console.log("PDF buffer type:", typeof pdfBuffer);
        console.log("PDF buffer is Buffer:", Buffer.isBuffer(pdfBuffer));

        // Set comprehensive headers for PDF response
        const headers = {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=invoice.pdf",
            "Content-Length": pdfBuffer.length.toString(),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Expose-Headers": "Content-Disposition"
        };

        res.set(headers);

        console.log("Sending PDF response with headers:", headers);
        console.log("Response status before sending:", res.statusCode);

        // Send the PDF buffer
        res.end(pdfBuffer);
        
        console.log("PDF response sent successfully");

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

// Test endpoint to verify PDF response handling
app.get("/test-pdf", async (req, res) => {
    try {
        console.log("Testing PDF generation and response...");
        
        const browser = await launchBrowser();
        const page = await browser.newPage();
        
        // Create a simple test HTML
        const testHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <h1>Test PDF Generation</h1>
                <p>This is a test PDF generated at ${new Date().toISOString()}</p>
                <p>If you can see this, PDF generation is working correctly!</p>
            </body>
            </html>
        `;
        
        await page.setContent(testHtml);
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true
        });
        
        await browser.close();
        
        console.log("Test PDF generated, size:", pdfBuffer.length, "bytes");
        
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=test.pdf",
            "Content-Length": pdfBuffer.length.toString(),
            "Cache-Control": "no-cache"
        });
        
        res.end(pdfBuffer);
        
    } catch (error) {
        console.error("Test PDF generation failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, async () => {
    console.log(`PDF Generator is running on http://localhost:${PORT}`);
    
    // Try to ensure Chrome is installed on startup
    if (process.env.RENDER) {
        console.log("Running on Render, checking Chrome installation on startup...");
        try {
            await ensureChromeInstalled();
        } catch (error) {
            console.log("Chrome installation check failed on startup, will retry on first request:", error.message);
        }
    }
});
