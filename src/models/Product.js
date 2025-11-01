import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        key: String,
        title: String,
        subTitle: String,
        images: [String],
        video: String,
        stock: Boolean,
        productDescription: Object,
        warrantyDetails: String,
        warnings: [String],
        legalDisclaimer: String,
        whatsInTheBox: [String],
        powerSpecs: Object,
        appInfo: Object,
        returnPolicy: String,
        ageRestriction: String,
        careInstructions: [String],
        certificationInfo: String,
        reviews: [Object],
        features: Object,
        services: [String],
        price: Number,
        originalPrice: Number,
        discount: Number,
        rating: Number,
        totalReviews: Number,
    },
    { timestamps: true }
);

export default mongoose.model("Product", productSchema);
