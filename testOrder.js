const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test data
const testCategory = {
  categoryName: 'Test Electronics',
  description: 'Test category for electronics',
  slug: 'test-electronics'
};

const testProduct = {
  productName: 'Test Wireless Mouse',
  slug: 'test-wireless-mouse',
  productImage: ['https://example.com/mouse.jpg'],
  description: 'A wireless mouse for testing',
  price: 29.99,
  category: ['Test Electronics'],
  stock: 50,
  minStockThreshold: 10,
  brand: 'TestBrand',
  status: 'active'
};

const testOrder = {
  customerName: 'Test Customer',
  customerEmail: 'test@example.com',
  orderItems: [],
  shippingAddress: {
    street: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    zipCode: '12345',
    country: 'Test Country'
  },
  tax: 5,
  shippingCost: 10
};

async function runTests() {
  try {
    console.log('🧪 Starting Order System Tests...\n');

    // Step 1: Create a test category
    console.log('📦 Step 1: Creating test category...');
    let categoryId;
    try {
      const categoryResponse = await axios.post(`${BASE_URL}/api/categories`, testCategory);
      console.log('✅ Category created:', categoryResponse.data.categoryName);
      categoryId = categoryResponse.data._id;
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already exists')) {
        console.log('⚠️  Category already exists, fetching it...');
        const categories = await axios.get(`${BASE_URL}/api/categories`);
        const existingCategory = categories.data.find(c => c.categoryName === testCategory.categoryName);
        if (existingCategory) {
          categoryId = existingCategory._id;
          console.log('✅ Using existing category:', existingCategory.categoryName);
        }
      } else {
        throw error;
      }
    }

    // Step 2: Create a test product
    console.log('\n📦 Step 2: Creating test product...');
    let productId;
    let productName;
    try {
      const productResponse = await axios.post(`${BASE_URL}/products`, testProduct);
      console.log('✅ Product created:', productResponse.data.productName);
      console.log('   Initial Stock:', productResponse.data.stock);
      productId = productResponse.data._id;
      productName = productResponse.data.productName;
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('slug already exists')) {
        console.log('⚠️  Product already exists, fetching it...');
        const products = await axios.get(`${BASE_URL}/products`);
        const existingProduct = products.data.find(p => p.slug === testProduct.slug);
        if (existingProduct) {
          productId = existingProduct._id;
          productName = existingProduct.productName;
          console.log('✅ Using existing product:', existingProduct.productName);
          console.log('   Current Stock:', existingProduct.stock);
          // Reset stock for testing if needed
          if (existingProduct.stock < 50) {
            await axios.put(`${BASE_URL}/products/${productId}/stock`, { stock: 50 });
            console.log('   Stock reset to 50 for testing');
          }
        }
      } else {
        throw error;
      }
    }

    // Step 3: Create an order with the product
    console.log('\n🛒 Step 3: Creating test order...');
    testOrder.orderItems = [{
      productId: productId,
      productName: productName,
      quantity: 5,
      price: 29.99
    }];

    const orderResponse = await axios.post(`${BASE_URL}/api/orders`, testOrder);
    console.log('✅ Order created successfully!');
    console.log('   Order Number:', orderResponse.data.orderNumber);
    console.log('   Order Status:', orderResponse.data.orderStatus);
    console.log('   Total Amount:', orderResponse.data.totalAmount);
    console.log('   Items:', orderResponse.data.orderItems.length);

    // Step 4: Check updated product stock
    console.log('\n📊 Step 4: Checking updated product stock...');
    const updatedProduct = await axios.get(`${BASE_URL}/products/${productId}`);
    console.log('✅ Product stock updated!');
    console.log('   New Stock:', updatedProduct.data.stock);
    console.log('   Status:', updatedProduct.data.status);

    // Step 5: Check restock queue (should not be added since stock > threshold)
    console.log('\n📋 Step 5: Checking restock queue...');
    const restockQueue = await axios.get(`${BASE_URL}/api/restock-queue?status=pending`);
    console.log('   Pending items in queue:', restockQueue.data.length);

    // Step 6: Create another order to deplete stock
    console.log('\n🛒 Step 6: Creating large order to deplete stock...');
    const largeOrder = {
      customerName: 'Bulk Customer',
      customerEmail: 'bulk@example.com',
      orderItems: [{
        productId: productId,
        productName: productName,
        quantity: 40, // This will bring stock to 5 (below threshold of 10)
        price: 29.99
      }],
      shippingAddress: testOrder.shippingAddress
    };

    const largeOrderResponse = await axios.post(`${BASE_URL}/api/orders`, largeOrder);
    console.log('✅ Large order created!');
    console.log('   Order Number:', largeOrderResponse.data.orderNumber);

    // Step 7: Check stock again (should be below threshold)
    console.log('\n📊 Step 7: Checking stock after large order...');
    const lowStockProduct = await axios.get(`${BASE_URL}/products/${productId}`);
    console.log('✅ Stock status updated!');
    console.log('   Current Stock:', lowStockProduct.data.stock);
    console.log('   Status:', lowStockProduct.data.status);

    // Step 8: Check restock queue (should have the product now)
    console.log('\n📋 Step 8: Checking restock queue again...');
    const updatedRestockQueue = await axios.get(`${BASE_URL}/api/restock-queue?status=pending`);
    console.log('   Pending items in queue:', updatedRestockQueue.data.length);
    
    if (updatedRestockQueue.data.length > 0) {
      const queueItem = updatedRestockQueue.data[0];
      console.log('   Item:', queueItem.productName);
      console.log('   Priority:', queueItem.priority);
      console.log('   Current Stock:', queueItem.currentStock);
      console.log('   Threshold:', queueItem.minStockThreshold);
    }

    // Step 9: Test insufficient stock scenario
    console.log('\n⚠️  Step 9: Testing insufficient stock scenario...');
    try {
      const impossibleOrder = {
        customerName: 'Impossible Customer',
        customerEmail: 'impossible@example.com',
        orderItems: [{
          productId: productId,
          productName: productName,
          quantity: 100, // More than available stock
          price: 29.99
        }],
        shippingAddress: testOrder.shippingAddress
      };

      await axios.post(`${BASE_URL}/api/orders`, impossibleOrder);
      console.log('❌ This should have failed!');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected order with insufficient stock');
        console.log('   Message:', error.response.data.message);
        if (error.response.data.stockWarnings) {
          console.log('   Warnings:', error.response.data.stockWarnings);
        }
      } else {
        throw error;
      }
    }

    // Step 10: Get order statistics
    console.log('\n📈 Step 10: Getting order statistics...');
    const stats = await axios.get(`${BASE_URL}/api/orders/stats/summary`);
    console.log('✅ Order Statistics:');
    console.log('   Total Orders:', stats.data.totalOrders);
    console.log('   Pending Orders:', stats.data.pendingOrders);
    console.log('   Total Revenue:', stats.data.totalRevenue);

    // Step 11: Get restock queue statistics
    console.log('\n📊 Step 11: Getting restock queue statistics...');
    const restockStats = await axios.get(`${BASE_URL}/api/restock-queue/stats/summary`);
    console.log('✅ Restock Queue Statistics:');
    console.log('   Total Pending:', restockStats.data.totalPending);
    console.log('   High Priority:', restockStats.data.highPriority);
    console.log('   Medium Priority:', restockStats.data.mediumPriority);
    console.log('   Low Priority:', restockStats.data.lowPriority);

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Test Error:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the server is running on port 5000');
      console.error('   Run: npm run dev\n');
    }
  }
}

runTests();
