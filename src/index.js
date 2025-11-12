// ✅ Load env first
import "../config/env.js";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import cron from "node-cron";
// ✅ WhatsApp Webhook handler
import whatsappWebhook from "./routes/whatsappWebhook.js";

// Routes
import userRoutes from "./routes/userRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sectionRoutes from "./routes/sectionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import adminComplaints from "./routes/adminComplaints.js";
import refundRetryJob from "./jobs/refundRetry.js";
import whatsappMessages from "./routes/whatsappMessages.js";
import whatsappChats from "./routes/whatsappChats.js";
import whatsappSend from "./routes/whatsappSend.js";

// ✅ Razorpay webhook handler
import razorWebhook from "./routes/razorWebhook.js";

// ✅ Connect DB
connectDB();

const app = express();

/* -----------------------------------------------------
   ✅ Razorpay Webhook (before body parser!)
----------------------------------------------------- */
app.post(
    "/razorpay/webhook",
    express.raw({ type: "*/*" }),
    razorWebhook
);
app.use("/webhook/whatsapp", express.json(), whatsappWebhook);

/* -----------------------------------------------------
   ✅ Middleware
----------------------------------------------------- */
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// ✅ Rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
});
app.use(limiter);

// ✅ CORS
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",")
    : ["http://localhost:5173"];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

// ✅ Logging
const logStream = fs.createWriteStream(
    path.join(process.cwd(), "server.log"),
    { flags: "a" }
);
app.use(morgan("combined", { stream: logStream }));
app.use(morgan("dev"));

/* -----------------------------------------------------
   ✅ Routes
----------------------------------------------------- */
app.use("/api/invoice", invoiceRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/complaints", adminComplaints);
app.use("/api/whatsapp/messages", whatsappMessages);
app.use("/api/whatsapp/chats", whatsappChats);
app.use("/api/whatsapp", whatsappSend);

/* -----------------------------------------------------
   ✅ Global Error
----------------------------------------------------- */
app.use((err, req, res, next) => {
    console.error("❌ Global Error:", err.message);
    fs.appendFileSync(
        path.join(process.cwd(), "server.log"),
        `[${new Date().toISOString()}] ${req.method} ${req.url} :: ${err.stack}\n`
    );

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Server error",
    });
});

/* -----------------------------------------------------
   ✅ Start Server
----------------------------------------------------- */
const PORT = process.env.PORT || 5000;

// Retry refunds every 10 minutes
cron.schedule("*/10 * * * *", refundRetryJob);

app.listen(PORT, () =>
    console.log(`🚀 Server running in ${process.env.NODE_ENV} on port ${PORT}`)
);
