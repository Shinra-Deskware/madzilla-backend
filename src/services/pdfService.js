import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";


// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load logo once
const logoPath = path.join(__dirname, "../assets/logo.png");
const logoBase64 = fs.readFileSync(logoPath, "base64");
// Load stamp once
const stampPath = path.join(__dirname, "../assets/stamp.png");
const stampBase64 = fs.readFileSync(stampPath, "base64");

export const generateInvoicePdf = async (invoice) => {
    // Ensure company object format
    invoice.company = {
        name: invoice.companyName,
        description: invoice.companyDescription,
        email: invoice.companyEmail,
        phone: invoice.companyPhone,
        address: invoice.companyAddress,
        logoBase64: logoBase64,
        stampBase64: stampBase64,
    };

    // Ensure customer object format
    invoice.customer = {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        address: invoice.customerAddress
    };

    // Normalize items into modern structure
    invoice.items = invoice.items.map((i, idx) => ({
        no: idx + 1,
        description: i.name || i.description,
        qty: Number(i.qty) || 1,
        unitPrice: Number(i.price) || 0,
        subtotal: (Number(i.qty) || 1) * (Number(i.price) || 0)
    }));

    // Calc totals
    invoice.subtotal = invoice.items.reduce((sum, i) => sum + i.subtotal, 0);
    invoice.tax = Number(invoice.tax) || 0;
    invoice.total = invoice.subtotal + invoice.tax;

    // Default payment info (will allow UI override later)
    invoice.orderInfo = invoice.orderInfo;
    // Default terms
    invoice.terms = invoice.terms || [
        "This invoice is valid proof of service rendered.",
        "Payment must be made as agreed upon."
    ];

    const templatePath = path.join(__dirname, "../templates/invoiceTemplate.ejs");

    const html = await ejs.renderFile(templatePath, { invoice });

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: "/usr/bin/google-chrome", // your working path
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--single-process",
            "--no-zygote"
        ]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    return pdfBuffer;
};