const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    
    brand: {
        type: String,
        trim: true
    },
    category: {
        type: [String],
        required: true
    },
    discount: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        default: 0
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
    },
    productImage: {
        type: [String],
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CartItem', cartItemSchema);