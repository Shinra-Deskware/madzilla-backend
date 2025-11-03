import fs from "fs";
import path from "path";

const otpFile = path.resolve(process.cwd(), "otp-cache.json");

let store = new Map();

// 🧩 Load from disk (survives server restart)
try {
    if (fs.existsSync(otpFile)) {
        const data = JSON.parse(fs.readFileSync(otpFile, "utf8"));
        store = new Map(data);
    }
} catch (err) {
    console.error("⚠️ OTP cache load error:", err);
}

// 💾 Persist to disk
function persist() {
    try {
        fs.writeFileSync(otpFile, JSON.stringify([...store]), "utf8");
    } catch (err) {
        console.error("⚠️ OTP cache write error:", err);
    }
}

/* -----------------------------------------------------
   ✅ Create OTP entry
----------------------------------------------------- */
export function createOtp({ requestId, identifier, otp, ttlSec = 300 }) {
    store.set(requestId, {
        identifier: String(identifier).trim(),
        otp: String(otp).trim(),
        expiresAt: Date.now() + ttlSec * 1000,
        attempts: 0,
        maxAttempts: 5,
    });
    persist();
}

/* -----------------------------------------------------
   ✅ Verify OTP
----------------------------------------------------- */
export function verifyOtp({ requestId, otp }) {
    const entry = store.get(requestId);
    if (!entry) return { ok: false, reason: "not_found" };

    if (Date.now() > entry.expiresAt) {
        store.delete(requestId);
        persist();
        return { ok: false, reason: "expired" };
    }

    if (entry.attempts >= entry.maxAttempts) {
        store.delete(requestId);
        persist();
        return { ok: false, reason: "locked" };
    }

    entry.attempts++;
    if (String(otp).trim() !== entry.otp) {
        persist();
        return { ok: false, reason: "mismatch", left: entry.maxAttempts - entry.attempts };
    }

    const identifier = entry.identifier;
    store.delete(requestId);
    persist();
    return { ok: true, identifier };
}
