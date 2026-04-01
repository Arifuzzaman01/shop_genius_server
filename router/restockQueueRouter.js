const express = require('express');
const router = express.Router();
const RestockQueue = require('../models/restockQueueSchema');
const Product = require('../models/productSchema');

// Get all items in restock queue with sorting by priority and stock level
router.get('/', async (req, res) => {
    try {
        const { status, priority } = req.query;
        const filter = {};
        
        // Filter by status
        if (status) {
            filter.status = status;
        } else {
            // Default to showing only pending items
            filter.status = 'pending';
        }
        
        // Filter by priority
        if (priority) {
            filter.priority = priority;
        }
        
        // Sort by lowest stock first, then by priority
        const restockItems = await RestockQueue.find(filter)
            .populate('productId', 'productName brand category')
            .sort({ 
                currentStock: 1,
                priority: 1
            });
        
        res.json(restockItems);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get items by priority
router.get('/priority/:priority', async (req, res) => {
    try {
        const { priority } = req.params;
        
        if (!['high', 'medium', 'low'].includes(priority)) {
            return res.status(400).json({ message: 'Invalid priority. Must be high, medium, or low' });
        }
        
        const restockItems = await RestockQueue.find({ 
            priority,
            status: 'pending'
        })
        .populate('productId', 'productName brand category')
        .sort({ currentStock: 1 });
        
        res.json(restockItems);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get restock queue statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const totalItems = await RestockQueue.countDocuments({ status: 'pending' });
        const highPriority = await RestockQueue.countDocuments({ 
            priority: 'high', 
            status: 'pending' 
        });
        const mediumPriority = await RestockQueue.countDocuments({ 
            priority: 'medium', 
            status: 'pending' 
        });
        const lowPriority = await RestockQueue.countDocuments({ 
            priority: 'low', 
            status: 'pending' 
        });
        const restockedToday = await RestockQueue.countDocuments({
            status: 'restocked',
            restockedAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });
        
        res.json({
            totalPending: totalItems,
            highPriority,
            mediumPriority,
            lowPriority,
            restockedToday
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single restock queue item by ID
router.get('/:id', async (req, res) => {
    try {
        const restockItem = await RestockQueue.findById(req.params.id)
            .populate('productId', 'productName brand category price stock minStockThreshold');
        
        if (!restockItem) {
            return res.status(404).json({ message: 'Restock queue item not found' });
        }
        
        res.json(restockItem);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid restock queue item ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Add product to restock queue manually
router.post('/:productId', async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Check if already in queue with pending status
        const existingItem = await RestockQueue.findOne({
            productId: product._id,
            status: 'pending'
        });
        
        if (existingItem) {
            return res.status(400).json({ 
                message: 'Product is already in the restock queue',
                item: existingItem
            });
        }
        
        // Calculate priority based on current stock
        let priority = 'low';
        if (product.stock === 0) {
            priority = 'high';
        } else if (product.stock < (product.minStockThreshold * 0.5)) {
            priority = 'medium';
        }
        
        const restockItem = new RestockQueue({
            productId: product._id,
            productName: product.productName,
            currentStock: product.stock,
            minStockThreshold: product.minStockThreshold,
            priority,
            notes: req.body.notes
        });
        
        await restockItem.save();
        
        res.status(201).json(restockItem);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        res.status(500).json({ message: err.message });
    }
});

// Mark item as restocked
router.put('/:id/restock', async (req, res) => {
    try {
        const restockItem = await RestockQueue.findById(req.params.id);
        
        if (!restockItem) {
            return res.status(404).json({ message: 'Restock queue item not found' });
        }
        
        if (restockItem.status === 'restocked') {
            return res.status(400).json({ message: 'Item is already marked as restocked' });
        }
        
        if (restockItem.status === 'removed') {
            return res.status(400).json({ message: 'Item was removed from queue' });
        }
        
        // Update the product's stock if new stock quantity is provided
        if (req.body.newStockQuantity !== undefined) {
            const product = await Product.findById(restockItem.productId);
            
            if (product) {
                product.stock = req.body.newStockQuantity;
                
                // Update product status based on new stock level
                if (product.stock >= product.minStockThreshold) {
                    product.status = 'active';
                } else if (product.stock > 0) {
                    product.status = 'low stock';
                } else {
                    product.status = 'out of stock';
                }
                
                await product.save();
            }
        }
        
        // Update restock queue item
        restockItem.status = 'restocked';
        restockItem.notes = req.body.notes || restockItem.notes;
        await restockItem.save();
        
        res.json({ 
            message: 'Item marked as restocked',
            item: restockItem
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid restock queue item ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update restock queue item (notes, priority, etc.)
router.put('/:id', async (req, res) => {
    try {
        const { notes, priority } = req.body;
        const updateData = {};
        
        if (notes !== undefined) updateData.notes = notes;
        if (priority && ['high', 'medium', 'low'].includes(priority)) {
            updateData.priority = priority;
        }
        
        const restockItem = await RestockQueue.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!restockItem) {
            return res.status(404).json({ message: 'Restock queue item not found' });
        }
        
        res.json(restockItem);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid restock queue item ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Remove item from queue
router.delete('/:id', async (req, res) => {
    try {
        const restockItem = await RestockQueue.findByIdAndDelete(req.params.id);
        
        if (!restockItem) {
            return res.status(404).json({ message: 'Restock queue item not found' });
        }
        
        res.json({ 
            message: 'Item removed from queue',
            item: restockItem
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid restock queue item ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
