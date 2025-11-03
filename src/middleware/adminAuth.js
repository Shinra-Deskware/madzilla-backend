import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function adminAuth(req, res, next) {
    try {
        const token = req.cookies?.session?.trim();
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized – no token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.uid) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
        }

        const user = await User.findById(decoded.uid).lean();
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("❌ AdminAuth error:", err.message);
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Session expired" });
        }
        return res.status(401).json({ success: false, message: "Invalid or missing token" });
    }
}
