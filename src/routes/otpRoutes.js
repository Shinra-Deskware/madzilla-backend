import express from 'express'
import { v4 as uuid } from 'uuid'
import { sendWhtspOtp } from '../services/whatsappService.js'
import { createOtp, verifyOtp } from '../utils/otpStore.js'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import { sendEmailOtp } from '../services/emailService.js'

const router = express.Router()

// 📩 SEND OTP
router.post('/send', async (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ error: "identifier required" });

    const requestId = uuid();
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digit

    console.log(`[OTP EMAIL] ${identifier} -> ${otp} (reqId=${requestId})`);

    createOtp({ requestId, identifier, otp, ttlSec: 300 });

    try {
        await sendEmailOtp(identifier, otp);
        return res.json({ requestId, expiresIn: 300 });
    } catch (err) {
        console.error("Email send error:", err?.response?.data || err.message);
        return res.status(502).json({ error: "email_send_failed" });
    }
});

// ✅ VERIFY OTP
router.post('/verify', async (req, res) => {
    const requestId = String(req.body.requestId || "").trim();
    const otp = String(req.body.otp || "").trim();

    const result = verifyOtp({ requestId, otp });
    if (!result.ok) {
        return res.status(400).json({ error: result.reason });
    }

    const identifier = result.identifier;
    if (!identifier) {
        return res.status(400).json({ error: "OTP session expired" });
    }

    const isEmail = identifier.includes("@");

    let user = await User.findOne(
        isEmail ? { emailId: identifier } : { phoneNumber: identifier }
    );

    if (!user) {
        user = await User.create(
            isEmail ? { emailId: identifier } : { phoneNumber: identifier }
        );
    }

    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });

    res.cookie("session", token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, user });
});



export default router
