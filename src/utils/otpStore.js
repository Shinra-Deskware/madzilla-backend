import fs from "fs";
import path from "path";

const otpFile = path.join(process.cwd(), "otp-cache.json");

// Load cache from disk (survive restart)
let store = new Map();
try {
    if (fs.existsSync(otpFile)) {
        const data = JSON.parse(fs.readFileSync(otpFile, "utf8"));
        store = new Map(data);
    }
} catch (err) {
    console.error("OTP cache load error", err);
}

// Save to disk
function persist() {
    try {
        fs.writeFileSync(otpFile, JSON.stringify([...store]), "utf8");
    } catch (err) {
        console.error("OTP cache write error", err);
    }
}

// ✅ Store
export function createOtp({ requestId, identifier, otp, ttlSec = 300 }) {
    store.set(requestId, {
        identifier,
        otp: String(otp).trim(),
        expiresAt: Date.now() + ttlSec * 1000,
        attempts: 0,
        maxAttempts: 5,
    });
    persist();
}

// ✅ Verify
export function verifyOtp({ requestId, otp }) {
    const r = store.get(requestId);
    if (!r) return { ok: false, reason: "not_found" };

    if (Date.now() > r.expiresAt) {
        store.delete(requestId);
        persist();
        return { ok: false, reason: "expired" };
    }

    if (r.attempts >= r.maxAttempts) {
        store.delete(requestId);
        persist();
        return { ok: false, reason: "locked" };
    }

    r.attempts++;

    if (String(otp).trim() !== r.otp) {
        persist();
        return { ok: false, reason: "mismatch", left: r.maxAttempts - r.attempts };
    }

    const identifier = r.identifier;
    store.delete(requestId);
    persist();
    return { ok: true, identifier };
}
