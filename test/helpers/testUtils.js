const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Product = require('../../models/Product');
const StockIntake = require('../../models/StockIntake');
const { clearTestDB } = require('./database');

/**
 * Create a test user
 * @param {Object} userData - User data
 * @returns {Object} Created user
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'password123',
    role: 'user'
  };
  
  const user = { ...defaultUser, ...userData };
  const passwordHash = await bcrypt.hash(user.password, 10);
  
  return await User.create({
    email: user.email,
    passwordHash,
    role: user.role
  });
};

/**
 * Create an admin test user
 * @param {Object} userData - User data
 * @returns {Object} Created admin user
 */
const createTestAdmin = async (userData = {}) => {
  return await createTestUser({
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    ...userData
  });
};

/**
 * Create a test product
 * @param {Object} productData - Product data
 * @returns {Object} Created product
 */
const createTestProduct = async (productData = {}) => {
  const defaultProduct = {
    name: 'Test Product',
    sku: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // Generate unique SKU
    quantity: 10,
    location: 'Warehouse A',
    weight: 1.5,
    // Support additional fields from tests
    code: productData.code,
    price: productData.price,
    stockQuantity: productData.stockQuantity,
    stockWeight: productData.stockWeight
  };
  
  const product = { ...defaultProduct, ...productData };
  return await Product.create(product);
};

/**
 * Create a test stock intake
 * @param {Object} intakeData - Stock intake data
 * @returns {Object} Created stock intake
 */
const createTestStockIntake = async (intakeData = {}) => {
  let product = intakeData.product;
  
  if (!product && intakeData.productId) {
    product = await Product.findById(intakeData.productId);
  }
  
  if (!product) {
    product = await createTestProduct();
  }
  
  const defaultIntake = {
    product: product._id,
    quantity: intakeData.quantity || 5,
    totalWeight: intakeData.weight || intakeData.totalWeight || 7.5,
    singleWeight: product.weight || 1.5,
    receivedBy: intakeData.receivedBy || 'test@example.com',
    notes: intakeData.notes
  };
  
  const intake = { ...defaultIntake, ...intakeData };
  intake.product = product._id;
  
  // Update product stock when creating test intake
  if (intake.quantity) {
    product.quantity = (product.quantity || 0) + intake.quantity;
    if (product.stockQuantity !== undefined) {
      product.stockQuantity = (product.stockQuantity || 0) + intake.quantity;
    }
    if (product.stockWeight !== undefined && intake.totalWeight) {
      product.stockWeight = (product.stockWeight || 0) + intake.totalWeight;
    }
    await product.save();
  }
  
  return await StockIntake.create(intake);
};

/**
 * Authenticate a user and return cookie
 * @param {Object} app - Express app
 * @param {Object} userData - User credentials
 * @returns {String} Authentication cookie
 */
const authenticateUser = async (app, userData = {}) => {
  const user = userData.email ? userData : { email: 'test@example.com', password: 'password123' };
  
  // Create user if not exists
  try {
    await createTestUser(user);
  } catch (error) {
    // User might already exist
  }
  
  const response = await chai.request(app)
    .post('/login')
    .redirects(0) // Don't follow redirects
    .send({
      email: user.email,
      password: user.password
    });
    
  // Extract cookies from response
  const cookies = response.headers['set-cookie'];
  if (cookies && cookies.length > 0) {
    return cookies[0]; // Return the first cookie
  }
  
  throw new Error('Authentication failed - no cookies received');
};

/**
 * Clean up all test data
 */
const cleanupTestData = async () => {
  await clearTestDB();
};

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestProduct,
  createTestStockIntake,
  authenticateUser,
  cleanupTestData
};