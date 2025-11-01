import mongoose from "mongoose";

const reviewsSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["video", "image"],
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        username: {
            type: String,
            required: true,
            trim: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 0,
            max: 5,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Reviews", reviewsSchema);
