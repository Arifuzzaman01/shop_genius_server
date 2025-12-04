const express = require('express');
const router = express.Router();
const CartItem = require('../models/cartSchema');

// Get all cart items
router.get('/', async (req, res) => {
    try {
        const { email } = req.query;
        
        // If email query parameter is provided, count products for that user
        if (email) {
            const count = await CartItem.countDocuments({ userEmail: email });
            return res.json({ count });
        }
        
        // Otherwise, return all cart items
        const cartItems = await CartItem.find();
        res.json(cartItems);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add item to cart
router.post('/', async (req, res) => {
    try {
        const cartItem = new CartItem({
            buyerName: req.body.buyerName,
            userEmail: req.body.userEmail,
            productName: req.body.productName,
            productId: req.body.productId,
            brand: req.body.brand,
            category: req.body.category,
            stock: req.body.stock,
            discount: req.body.discount,
            price: req.body.price,
            productImage: req.body.productImage
        });
        
        const newCartItem = await cartItem.save();
        res.status(201).json(newCartItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a cart item
router.delete('/:id', async (req, res) => {
    try {
        const cartItem = await CartItem.findByIdAndDelete(req.params.id);
        if (!cartItem) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        res.json({ message: 'Cart item deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete all cart items
router.delete('/', async (req, res) => {
    try {
        await CartItem.deleteMany({});
        res.json({ message: 'All cart items deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;