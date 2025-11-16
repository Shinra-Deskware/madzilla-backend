import express from "express";
import { v4 as uuid } from "uuid";
import { createOtp, verifyOtp } from "../utils/otpStore.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendEmailOtp } from "../services/emailService.js";

const router = express.Router();

/**
 * 📩 SEND OTP (Email or Phone)
 */
router.post("/send", async (req, res) => {
    try {
        let { identifier, purpose } = req.body || {};
        if (!identifier) return res.status(400).json({ error: "identifier required" });

        identifier = String(identifier).trim().toLowerCase();

        const isEmail = identifier.includes("@");
        const isPhone = /^\d{10}$/.test(identifier);

        if (!isEmail && !isPhone)
            return res.status(400).json({ error: "Invalid identifier format" });

        const requestId = uuid();
        const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
        console.log(`[OTP] ${identifier} -> ${otp} (reqId=${requestId}) purpose=${purpose}`);

        createOtp({ requestId, identifier, otp, ttlSec: 300 });

        if (isEmail) {
            await sendEmailOtp(identifier, otp);
        }

        return res.json({ requestId, expiresIn: 300 });
    } catch (err) {
        console.error("OTP send error:", err?.response?.data || err.message);
        return res.status(502).json({ error: "otp_send_failed" });
    }
});

/**
 * ✅ VERIFY OTP (Login OR Cancel Order)
 */
router.post("/verify", async (req, res) => {
    try {
        const requestId = String(req.body.requestId || "").trim();
        const otp = String(req.body.otp || "").trim();
        const purpose = req.body.purpose || null;

        const result = verifyOtp({ requestId, otp });
        if (!result.ok) {
            return res.status(400).json({ error: result.reason });
        }

        const identifier = result.identifier;
        if (!identifier) {
            return res.status(400).json({ error: "OTP session expired" });
        }

        const cleanId = String(identifier).trim().toLowerCase();
        const isEmail = cleanId.includes("@");
        const isPhone = /^\d{10}$/.test(cleanId);

        if (!isEmail && !isPhone)
            return res.status(400).json({ error: "Invalid identifier" });

        const query = isEmail ? { emailId: cleanId } : { phoneNumber: cleanId };

        // ✅ Cancel Order OTP — do NOT log in, only verify
        if (purpose === "cancel_order") {
            return res.json({ success: true, verified: true });
        }

        // ✅ Normal Login Flow
        let user = await User.findOne(query);
        if (!user) user = await User.create(query);

        const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.cookie("session", token, {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ success: true, user });
    } catch (err) {
        console.error("OTP verify error:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

export default router;
