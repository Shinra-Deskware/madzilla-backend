import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import otpRoutes from './routes/otpRoutes.js';
import authRoutes from './routes/authRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from "./routes/adminRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import adminComplaints from "./routes/adminComplaints.js";

dotenv.config();
connectDB();

const app = express();

const allowedOrigins = process.env.CLIENT_URL.split(",");

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS not allowed"));
    },
    credentials: true,
}));


app.use(express.json());
app.use(cookieParser());

// 👇 Add this middleware to expose the cookie properly
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use("/api/invoice", invoiceRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/otp', otpRoutes);
app.use("/api/complaints", complaintRoutes);

// admin
app.use("/api/admin", adminRoutes);
app.use("/api/admin/complaints", adminComplaints);

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
});

app.listen(process.env.PORT || 5000, () =>
    console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
);