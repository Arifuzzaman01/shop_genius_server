const express = require('express');
const router = express.Router();
const Product = require('../models/productSchema');
const mongoose = require('mongoose');

// Add middleware to log all product requests (this should be before route definitions)
router.use((req, res, next) => {
  next();
});

// Define more specific routes first
// Get products separated by category
router.get('/by-category', async (req, res) => {
  try {
    
    // Test MongoDB connection first
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: 'Database connection not ready' });
    }
    
    const products = await Product.find({});
    
    // Return empty array if no products found
    if (products.length === 0) {
      return res.json([]);
    }
    
    // Group products by category
    const categoriesMap = {};
    
    products.forEach(product => {
      // Handle case where category might be undefined or null
      if (product.category && Array.isArray(product.category)) {
        // Each product can belong to multiple categories
        product.category.forEach(cat => {
          // Ensure category is a valid string
          if (typeof cat === 'string' && cat.trim() !== '') {
            if (!categoriesMap[cat]) {
              // Generate a slug from the category name
              const categorySlug = cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              
              categoriesMap[cat] = {
                categoryId: categorySlug, // Using slug as ID
                categoryName: cat,
                productCount: 0
              };
            }
            // Increment product count for this category
            categoriesMap[cat].productCount += 1;
          }
        });
      }
    });
    
    // Convert map to array of objects
    const categoriesArray = Object.values(categoriesMap);
    
    res.json(categoriesArray);
  } catch (err) {
    console.error('Error in by-category route:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get products by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Get all products with optional filtering by variant (this should be last)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    
    // Filter by variant if provided
    if (req.query.type) {
      filter.variant = req.query.type;
    }
    
    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new product (Add method)
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: 'Validation Error', errors });
    }
    // Handle duplicate key errors (e.g., duplicate slug)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Product with this slug already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Update a product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: 'Validation Error', errors });
    }
    // Handle duplicate key errors (e.g., duplicate slug)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Product with this slug already exists' });
    }
    // Handle invalid ID errors
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;