const Product = require('../models/productSchema');
const RestockQueue = require('../models/restockQueueSchema');

/**
 * Check if requested quantity is available in stock
 * @param {string} productId - Product ID to check
 * @param {number} requestedQuantity - Quantity requested
 * @returns {object} - { available, currentStock, message }
 */
async function checkStockAvailability(productId, requestedQuantity) {
    try {
        const product = await Product.findById(productId);
        
        if (!product) {
            return {
                exists: false,
                available: false,
                currentStock: 0,
                message: 'Product not found'
            };
        }
        
        const available = product.stock >= requestedQuantity;
        
        return {
            exists: true,
            available,
            currentStock: product.stock,
            productName: product.productName,
            message: available 
                ? 'Stock available' 
                : `Only ${product.stock} items available in stock`
        };
    } catch (error) {
        throw new Error(`Error checking stock availability: ${error.message}`);
    }
}

/**
 * Deduct stock for a product
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to deduct
 * @returns {object} - Updated product
 */
async function deductStock(productId, quantity) {
    try {
        const product = await Product.findById(productId);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        if (product.stock < quantity) {
            throw new Error('Insufficient stock');
        }
        
        product.stock -= quantity;
        
        // Update status based on new stock level
        if (product.stock === 0) {
            product.status = 'out of stock';
        } else if (product.stock < product.minStockThreshold) {
            product.status = 'low stock';
        } else {
            product.status = 'active';
        }
        
        await product.save();
        
        // Add to restock queue if below threshold
        if (product.stock < product.minStockThreshold && product.stock > 0) {
            await triggerRestockQueue(productId);
        }
        
        return product;
    } catch (error) {
        throw new Error(`Error deducting stock: ${error.message}`);
    }
}

/**
 * Update product status based on stock level
 * @param {string} productId - Product ID
 * @returns {object} - Updated product
 */
async function updateProductStatus(productId) {
    try {
        const product = await Product.findById(productId);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        const previousStatus = product.status;
        
        if (product.stock === 0) {
            product.status = 'out of stock';
        } else if (product.stock < product.minStockThreshold) {
            product.status = 'low stock';
        } else {
            product.status = 'active';
        }
        
        if (previousStatus !== product.status) {
            await product.save();
        }
        
        return product;
    } catch (error) {
        throw new Error(`Error updating product status: ${error.message}`);
    }
}

/**
 * Add product to restock queue if below threshold
 * @param {string} productId - Product ID
 * @returns {object|null} - Restock queue item or null
 */
async function triggerRestockQueue(productId) {
    try {
        const product = await Product.findById(productId);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        // Check if already in queue with pending status
        const existingItem = await RestockQueue.findOne({
            productId: product._id,
            status: 'pending'
        });
        
        if (existingItem) {
            return existingItem;
        }
        
        // Calculate priority
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
            priority
        });
        
        await restockItem.save();
        
        return restockItem;
    } catch (error) {
        throw new Error(`Error triggering restock queue: ${error.message}`);
    }
}

/**
 * Restore stock (for cancelled orders or returns)
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to restore
 * @returns {object} - Updated product
 */
async function restoreStock(productId, quantity) {
    try {
        const product = await Product.findById(productId);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        product.stock += quantity;
        
        // Update status
        if (product.status === 'out of stock') {
            product.status = product.stock < product.minStockThreshold ? 'low stock' : 'active';
        } else if (product.status === 'low stock' && product.stock >= product.minStockThreshold) {
            product.status = 'active';
        }
        
        // Remove from restock queue if stock is above threshold
        if (product.stock >= product.minStockThreshold) {
            await RestockQueue.deleteOne({
                productId: product._id,
                status: 'pending'
            });
        }
        
        await product.save();
        
        return product;
    } catch (error) {
        throw new Error(`Error restoring stock: ${error.message}`);
    }
}

module.exports = {
    checkStockAvailability,
    deductStock,
    updateProductStatus,
    triggerRestockQueue,
    restoreStock
};
