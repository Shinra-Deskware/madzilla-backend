import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    emailId: { type: String, trim: true },
    phoneNumber: { type: String, unique: true, required: true },
    fullName: { type: String, default: '' },
    // inside userSchema
    isAdmin: { type: Boolean, default: false },
    // 🏠 keep everything organized under one address object
    address: {
        country: { type: String, default: 'India' },
        state: { type: String, default: '' },
        city: { type: String, default: '' },
        pinCode: { type: String, default: '' },
        addr1: { type: String, default: '' }
    },

    orders: [{ type: String }],
    cart: { type: Array, default: [] }
}, { timestamps: true })

export default mongoose.model('User', userSchema)