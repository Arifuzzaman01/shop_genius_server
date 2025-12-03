const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    productImage: {
        type: [String],
        required: true,
        validate: {
            validator: function(v) {
                return v.length >= 1;
            },
            message: props => `Product must have at least 1 image, got ${props.value.length}`
        }
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
    },
    discount: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        default: 0
    },
    category: {
        type: [String],
        required: true,
        validate: {
            validator: function(v) {
                return v.length >= 1;
            },
            message: props => `Product must belong to at least 1 category, got ${props.value.length}`
        }
    },
    stock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative']
    },
    brand: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['sales', 'hot', 'new', 'out of stock'],
        default: 'draft'
    },
    variant: {
        type: String,
        enum: ['gadget', 'appliances', 'refrigerators', 'others'],
        default: 'gadget'
    },
    featured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);