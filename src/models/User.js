import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema(
    {
        key: { type: String },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String },
        price: { type: Number },
        count: { type: Number, default: 1, min: 0 },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        emailId: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
        phoneNumber: { type: String, trim: true, unique: true, sparse: true },

        fullName: { type: String, default: '' },
        isAdmin: { type: Boolean, default: false },

        address: {
            country: { type: String, default: 'India' },
            state: { type: String, default: '' },
            city: { type: String, default: '' },
            pinCode: { type: String, default: '' },
            addr1: { type: String, default: '' },
        },

        // keep as strings for now to avoid ripple changes
        orders: [{ type: String }],

        // structured but lenient
        cart: { type: [CartItemSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model('User', userSchema);
