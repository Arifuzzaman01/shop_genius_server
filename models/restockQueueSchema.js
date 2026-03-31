const mongoose = require('mongoose');

const restockQueueSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    currentStock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative']
    },
    minStockThreshold: {
        type: Number,
        required: true,
        min: [0, 'Minimum stock threshold cannot be negative']
    },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low'
    },
    status: {
        type: String,
        enum: ['pending', 'restocked', 'removed'],
        default: 'pending'
    },
    notes: {
        type: String,
        trim: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    restockedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
restockQueueSchema.index({ status: 1, priority: 1, currentStock: 1 });

// Pre-save middleware to auto-update priority based on stock level
restockQueueSchema.pre('save', function(next) {
    if (this.isModified('currentStock') || this.isModified('minStockThreshold')) {
        if (this.currentStock === 0) {
            this.priority = 'high';
        } else if (this.currentStock < (this.minStockThreshold * 0.5)) {
            this.priority = 'medium';
        } else {
            this.priority = 'low';
        }
    }
    
    // Set restockedAt when status changes to 'restocked'
    if (this.isModified('status') && this.status === 'restocked' && !this.restockedAt) {
        this.restockedAt = new Date();
    }
    
    next();
});

module.exports = mongoose.model('RestockQueue', restockQueueSchema);
