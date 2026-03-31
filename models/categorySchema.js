const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    categoryName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    productCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Pre-save middleware to auto-generate slug from categoryName
categorySchema.pre('save', function(next) {
    if (this.isModified('categoryName')) {
        this.slug = this.categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    next();
});

module.exports = mongoose.model('Category', categorySchema);
