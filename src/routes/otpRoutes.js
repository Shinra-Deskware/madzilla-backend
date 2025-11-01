import express from 'express'
import { v4 as uuid } from 'uuid'
import { sendHelloWorld } from '../services/whatsappService.js'
import { createOtp, verifyOtp } from '../utils/otpStore.js'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

// 📩 SEND OTP
router.post('/send', async (req, res) => {
    const { identifier } = req.body || {}
    if (!identifier) return res.status(400).json({ error: 'identifier required' })

    const requestId = uuid()
    // const otp = String(Math.floor(100000 + Math.random() * 900000)) // 6-digit
    const otp = "123456";
    console.log(`[OTP] ${identifier} -> ${otp} (reqId=${requestId})`)

    createOtp({ requestId, phone: identifier, otp, ttlSec: 300 })

    // try {
    //     await sendHelloWorld(identifier, otp)
    //     return res.json({ requestId, expiresIn: 300 })
    // } catch (err) {
    //     console.error('WhatsApp send error:', err?.response?.data || err.message)
    //     return res.status(502).json({ error: 'whatsapp_send_failed' })
    // }
    return res.json({ requestId, expiresIn: 300 })
})

// ✅ VERIFY OTP
router.post('/verify', async (req, res) => {
    const { requestId, otp } = req.body
    const result = verifyOtp({ requestId, otp })

    if (!result.ok) {
        return res.status(400).json({ error: result.reason })
    }

    const phoneNumber = result.phone

    // find or create user
    let user = await User.findOne({ phoneNumber })
    if (!user) {
        user = await User.create({ phoneNumber })
    }

    // create JWT
    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    })

    // set cookie
    res.cookie('session', token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });


    res.json({ success: true, user })
})

export default router
