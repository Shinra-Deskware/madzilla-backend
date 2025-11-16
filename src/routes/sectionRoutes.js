import express from "express";
import Reviews from "../models/Reviews.js";
import Product from "../models/Product.js";

const router = express.Router();

// 📦 Get all products
router.get("/products", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/reviews", async (req, res) => {
    try {
        const reviews = await Reviews.find();
        res.json(reviews);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server error" });
    }
});


export default router;
