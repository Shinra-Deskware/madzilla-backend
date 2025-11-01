// Simple in-memory store with TTL and attempts
const store = new Map()

export function createOtp({ requestId, phone, otp, ttlSec = 300 }) {
    store.set(requestId, {
        phone,
        otp,                 // plain for now (you asked to see it)
        expiresAt: Date.now() + ttlSec * 1000,
        attempts: 0,
        maxAttempts: 5,
    })
}

export function verifyOtp({ requestId, otp }) {
    const r = store.get(requestId)
    if (!r) return { ok: false, reason: 'not_found' }
    if (Date.now() > r.expiresAt) { store.delete(requestId); return { ok: false, reason: 'expired' } }
    if (r.attempts >= r.maxAttempts) { store.delete(requestId); return { ok: false, reason: 'locked' } }

    r.attempts += 1
    if (r.otp !== otp) return { ok: false, reason: 'mismatch', left: r.maxAttempts - r.attempts }

    store.delete(requestId)
    return { ok: true, phone: r.phone }
}
