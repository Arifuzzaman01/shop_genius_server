const express = require('express');
const router = express.Router();
const Payment = require('../models/paymentSchema');

// Process a new payment
router.post('/', async (req, res) => {
    try {
        const payment = new Payment({
            userEmail: req.body.userEmail,
            orderId: req.body.orderId,
            amount: req.body.amount,
            currency: req.body.currency || 'BDT',
            paymentMethod: req.body.paymentMethod,
            paymentStatus: req.body.paymentStatus || 'pending',
            transactionId: req.body.transactionId,
            items: req.body.items,
            shippingAddress: req.body.shippingAddress
        });

        const newPayment = await payment.save();
        res.status(201).json(newPayment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all payments
router.get('/', async (req, res) => {
    try {
        const payments = await Payment.find();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json(payment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get payments by user email
router.get('/user/:email', async (req, res) => {
    try {
        const payments = await Payment.find({ userEmail: req.params.email });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update payment status
router.patch('/:id', async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            { paymentStatus: req.body.paymentStatus },
            { new: true }
        );
        
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        
        res.json(payment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a payment
router.delete('/:id', async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json({ message: 'Payment deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;