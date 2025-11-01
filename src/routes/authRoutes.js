import express from "express";
const router = express.Router();

// 🔒 Logout user and clear session cookie
router.post("/logout", (req, res) => {
    try {
        res.clearCookie("session", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ success: false, message: "Logout failed" });
    }
});

export default router;
