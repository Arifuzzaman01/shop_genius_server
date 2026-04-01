const express = require('express');
const router = express.Router();
const Order = require('../models/orderSchema');
const Product = require('../models/productSchema');
const RestockQueue = require('../models/restockQueueSchema');
const mongoose = require('mongoose');

// Get all orders with optional filtering
router.get('/', async (req, res) => {
    try {
        const { status, date, customerEmail } = req.query;
        const filter = {};
        
        // Filter by status
        if (status) {
            filter.orderStatus = status;
        }
        
        // Filter by customer email
        if (customerEmail) {
            filter.customerEmail = customerEmail;
        }
        
        // Filter by date (today, this week, this month)
        if (date) {
            const now = new Date();
            if (date === 'today') {
                filter.createdAt = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
                };
            } else if (date === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filter.createdAt = { $gte: weekAgo };
            } else if (date === 'month') {
                filter.createdAt = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1)
                };
            }
        }
        
        const orders = await Order.find(filter).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get order statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
        const confirmedOrders = await Order.countDocuments({ orderStatus: 'confirmed' });
        const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
        const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
        const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });
        
        const revenue = await Order.aggregate([
            { $match: { orderStatus: { $in: ['confirmed', 'shipped', 'delivered'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        res.json({
            totalOrders,
            pendingOrders,
            confirmedOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue: revenue[0]?.total || 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Create new order with stock validation and deduction
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { customerName, customerEmail, orderItems, shippingAddress, tax, shippingCost, notes } = req.body;
        
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }
        
        // Validate stock availability for all items
        const stockValidationResults = [];
        for (const item of orderItems) {
            const product = await Product.findById(item.productId).session(session);
            
            if (!product) {
                await session.abortTransaction();
                return res.status(404).json({ 
                    message: `Product with ID ${item.productId} not found` 
                });
            }
            
            if (product.stock < item.quantity) {
                stockValidationResults.push({
                    productId: item.productId,
                    productName: product.productName,
                    requestedQuantity: item.quantity,
                    availableStock: product.stock,
                    message: `Only ${product.stock} items available in stock`
                });
            }
        }
        
        // If any items have insufficient stock, return warning
        if (stockValidationResults.length > 0) {
            await session.abortTransaction();
            return res.status(400).json({
                message: 'Insufficient stock for some items',
                stockWarnings: stockValidationResults
            });
        }
        
        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const finalTax = tax || 0;
        const finalShipping = shippingCost || 0;
        const totalAmount = subtotal + finalTax + finalShipping;
        
        // Create the order
        const order = new Order({
            customerName,
            customerEmail,
            orderItems,
            subtotal,
            tax: finalTax,
            shippingCost: finalShipping,
            totalAmount,
            shippingAddress,
            notes
        });
        
        await order.save({ session });
        
        // Deduct stock for each item
        for (const item of orderItems) {
            const product = await Product.findById(item.productId).session(session);
            
            // Deduct stock
            product.stock -= item.quantity;
            
            // Update status based on stock level
            if (product.stock === 0) {
                product.status = 'out of stock';
            } else if (product.stock < product.minStockThreshold) {
                product.status = 'low stock';
                
                // Add to restock queue if not already there
                const existingQueueItem = await RestockQueue.findOne({ 
                    productId: product._id,
                    status: 'pending'
                }).session(session);
                
                if (!existingQueueItem) {
                    const priority = calculatePriority(product.stock, product.minStockThreshold);
                    const restockItem = new RestockQueue({
                        productId: product._id,
                        productName: product.productName,
                        currentStock: product.stock,
                        minStockThreshold: product.minStockThreshold,
                        priority
                    });
                    await restockItem.save({ session });
                }
            } else {
                product.status = 'active';
            }
            
            await product.save({ session });
        }
        
        await session.commitTransaction();
        
        // Populate the created order before sending response
        const createdOrder = await Order.findById(order._id);
        res.status(201).json(createdOrder);
    } catch (err) {
        await session.abortTransaction();
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        res.status(500).json({ message: err.message });
    } finally {
        session.endSession();
    }
});

// Helper function to calculate restock priority
function calculatePriority(currentStock, threshold) {
    if (currentStock === 0) return 'high';
    const percentage = (currentStock / threshold) * 100;
    if (percentage < 50) return 'medium';
    return 'low';
}

function canTransitionOrderStatus(currentStatus, nextStatus) {
    const allowedTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'cancelled'],
        shipped: ['delivered'],
        delivered: [],
        cancelled: []
    };

    if (currentStatus === nextStatus) return true;
    return (allowedTransitions[currentStatus] || []).includes(nextStatus);
}

// Update order status
router.put('/:id', async (req, res) => {
    try {
        const { orderStatus, paymentStatus, notes } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const updateData = {};

        if (orderStatus) {
            if (!canTransitionOrderStatus(order.orderStatus, orderStatus)) {
                return res.status(400).json({
                    message: `Invalid order status transition from ${order.orderStatus} to ${orderStatus}`
                });
            }
            updateData.orderStatus = orderStatus;
        }
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (notes !== undefined) updateData.notes = notes;
        
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        res.json(updatedOrder);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update order status only
router.patch('/:id/status', async (req, res) => {
    try {
        const { orderStatus } = req.body;

        if (!orderStatus) {
            return res.status(400).json({ message: 'orderStatus is required' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!canTransitionOrderStatus(order.orderStatus, orderStatus)) {
            return res.status(400).json({
                message: `Invalid order status transition from ${order.orderStatus} to ${orderStatus}`
            });
        }

        order.orderStatus = orderStatus;
        await order.save();

        res.json({
            message: 'Order status updated successfully',
            order
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Cancel order
router.put('/:id/cancel', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const order = await Order.findById(req.params.id).session(session);
        
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Order not found' });
        }
        
        if (order.orderStatus === 'cancelled') {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Order is already cancelled' });
        }
        
        if (['shipped', 'delivered'].includes(order.orderStatus)) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: 'Cannot cancel order that has been shipped' 
            });
        }
        
        // Restore stock for cancelled order
        for (const item of order.orderItems) {
            const product = await Product.findById(item.productId).session(session);
            
            if (product) {
                product.stock += item.quantity;
                
                // Update status from 'out of stock' to appropriate status
                if (product.status === 'out of stock') {
                    product.status = product.stock < product.minStockThreshold ? 'low stock' : 'active';
                }
                
                // Remove from restock queue if it exists
                await RestockQueue.deleteOne({ 
                    productId: product._id,
                    status: 'pending'
                }).session(session);
                
                await product.save({ session });
            }
        }
        
        order.orderStatus = 'cancelled';
        await order.save({ session });
        
        await session.commitTransaction();
        
        res.json({ message: 'Order cancelled successfully', order });
    } catch (err) {
        await session.abortTransaction();
        res.status(500).json({ message: err.message });
    } finally {
        session.endSession();
    }
});

module.exports = router;
