// ✅ Load environment variables BEFORE anything else
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
import razorWebhook from "./routes/razorWebhook.js";
import refundRetryJob from "./jobs/refundRetry.js";

// ✅ Connect DB AFTER env loaded
connectDB();

const app = express();

/* -----------------------------------------------------
   ⚠️ Razorpay Webhook MUST be before express.json()
   AND must use express.raw() at mount time
----------------------------------------------------- */
app.post(
    "/razorpay/webhook",
    express.raw({ type: "*/*" }), // ✅ forces raw body for signature
    razorWebhook
);

/* -----------------------------------------------------
   🔒 Security & Core Middleware
----------------------------------------------------- */
app.use(helmet());
app.use(express.json()); // ✅ Safe now (after webhook)
app.use(cookieParser());

// 🧱 Rate limit: 100 req / 15 min
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: "Too many requests, please try again later.",
});
app.use(limiter);

/* -----------------------------------------------------
   🌐 CORS
----------------------------------------------------- */
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",")
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) callback(null, true);
            else callback(new Error("CORS not allowed"));
        },
        credentials: true,
    })
);

// ✅ Allow credentials
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});

/* -----------------------------------------------------
   🪵 Logging (Morgan)
----------------------------------------------------- */
const logStream = fs.createWriteStream(
    path.join(process.cwd(), "server.log"),
    { flags: "a" }
);
app.use(morgan("combined", { stream: logStream }));
app.use(morgan("dev"));

/* -----------------------------------------------------
   🛠 Routes
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

/* -----------------------------------------------------
   ⚠️ Global Error Handler
----------------------------------------------------- */
app.use((err, req, res, next) => {
    console.error("❌ Global Error:", err.message);
    fs.appendFileSync(
        path.join(process.cwd(), "server.log"),
        `[${new Date().toISOString()}] ${req.method} ${req.url} :: ${err.stack}\n`
    );

    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || "Internal server error",
    });
});

/* -----------------------------------------------------
   🚀 Start Server
----------------------------------------------------- */
const PORT = process.env.PORT || 5000;

// Retry refunds every 10 minutes
cron.schedule("*/10 * * * *", refundRetryJob);

app.listen(PORT, () =>
    console.log(`🚀 Server running in ${process.env.NODE_ENV} on port ${PORT}`)
);
