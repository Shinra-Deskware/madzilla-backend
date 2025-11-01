import express from "express";
import { generateInvoicePdf } from "../services/pdfService.js";

const router = express.Router();

// Download invoice by orderId
router.get("/:orderId/download", async (req, res) => {
    console.log("gggggggg")
    try {
        const { orderId } = req.params;

        const pdfBuffer = await generateInvoicePdf(orderId);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="invoice-${orderId}.pdf"`,
            "Content-Length": pdfBuffer.length
        });

        return res.send(pdfBuffer);
    } catch (err) {
        console.error("Invoice Error:", err);
        res.status(500).json({ message: "Failed to generate invoice" });
    }
});
router.post("/generate", async (req, res) => {
    try {
        const invoiceData = req.body; // ✅ full invoice JSON from frontend

        const pdfBuffer = await generateInvoicePdf(invoiceData);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="invoice-${invoiceData.number}.pdf"`,
            "Content-Length": pdfBuffer.length
        });

        return res.send(pdfBuffer);
    } catch (err) {
        console.error("Invoice Error:", err);
        res.status(500).json({ message: "Failed to generate invoice" });
    }
});

export default router;
