import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function adminAuth(req, res, next) {
    try {
        const token = req.cookies?.session;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.uid);
        if (!user || !user.isAdmin) return res.status(403).json({ message: "Access denied" });

        req.user = user;
        next();
    } catch (err) {
        console.error("AdminAuth error:", err);
        res.status(401).json({ message: "Invalid token" });
    }
}
