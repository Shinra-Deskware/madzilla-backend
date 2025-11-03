import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema(
    {
        key: { type: String },
        productId: { type: String },
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

        orders: [{ type: String }],
        cart: { type: [CartItemSchema], default: [] },
    },
    { timestamps: true }
);

/** ✅ Ensure at least one identifier exists */
userSchema.pre('validate', function (next) {
    if (!this.emailId && !this.phoneNumber) {
        next(new Error('Either emailId or phoneNumber is required'));
    } else {
        next();
    }
});

export default mongoose.model('User', userSchema);
