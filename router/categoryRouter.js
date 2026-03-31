const express = require('express');
const router = express.Router();
const Category = require('../models/categorySchema');
const Product = require('../models/productSchema');

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ categoryName: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single category by ID
router.get('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Get products in a category
router.get('/:id/products', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        
        const products = await Product.find({ category: category.categoryName });
        res.json(products);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Create new category
router.post('/', async (req, res) => {
    try {
        const category = new Category(req.body);
        const newCategory = await category.save();
        res.status(201).json(newCategory);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Category with this name already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Category with this name already exists' });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Delete category
router.delete('/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
