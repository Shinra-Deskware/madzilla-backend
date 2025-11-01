import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import connectDB from "../config/db.js";
import Reviews from "../models/Reviews.js";

await connectDB();
const reviewsData = [
    { id: 1, type: "video", url: 'A4', username: "Madhu", rating: 4.5, message: "Loved the toy!" },
    { id: 2, type: "video", url: 'videoSrc', username: "Aisha", rating: 5, message: "Amazing quality!" },
    { id: 3, type: "image", url: 'A1', username: "Rahul", rating: 3.5, message: "Pretty decent product." },
    { id: 4, type: "image", url: 'A2', username: "Kavya", rating: 4, message: "Good packaging." },
    { id: 5, type: "video", url: 'A4', username: "Madhu", rating: 4.5, message: "Loved the toy!" },
    { id: 6, type: "image", url: 'A3', username: "Aisha", rating: 5, message: "Amazing quality!" },
    { id: 7, type: "image", url: 'A1', username: "Rahul", rating: 3.5, message: "Pretty decent product." },
    { id: 8, type: "video", url: 'videoSrc', username: "Kavya", rating: 4, message: "Good packaging." },
];
await Reviews.insertMany(reviewsData);
console.log("Reviews data inserted!");
process.exit();

