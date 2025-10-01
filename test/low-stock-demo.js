const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { connectTestDB, disconnectTestDB, clearTestData } = require('./helpers/database');

describe('Low Stock Alert System Demo', function() {
  before(async function() {
    await connectTestDB();
  });

  after(async function() {
    await disconnectTestDB();
  });

  beforeEach(async function() {
    await clearTestData();
  });

  describe('Low Stock Detection', function() {
    it('should detect products below minimum stock threshold', async function() {
      // Create a test user first
      const userResponse = await request(app)
        .post('/register')
        .send({
          email: 'testuser@example.com',
          password: 'password123'
        });

      // Login to get session
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'testuser@example.com',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Create a product with low stock
      const productResponse = await request(app)
        .post('/products')
        .set('Cookie', cookies)
        .send({
          name: 'Test Low Stock Product',
          sku: 'LSP001',
          quantity: 5,  // Below default minStockLevel of 10
          weight: 1.5,
          description: 'A product for testing low stock alerts'
        });

      // Check low stock count
      const lowStockCountResponse = await request(app)
        .get('/stock-intake/data/low-stock/count')
        .set('Cookie', cookies);

      console.log('Low Stock Count Response:', lowStockCountResponse.body);
      expect(lowStockCountResponse.status).to.equal(200);
      expect(lowStockCountResponse.body).to.have.property('count');
      expect(lowStockCountResponse.body.count).to.be.greaterThan(0);

      // Check low stock products
      const lowStockProductsResponse = await request(app)
        .get('/stock-intake/data/low-stock/products')
        .set('Cookie', cookies);

      console.log('Low Stock Products Response:', lowStockProductsResponse.body);
      expect(lowStockProductsResponse.status).to.equal(200);
      expect(lowStockProductsResponse.body).to.have.property('products');
      expect(lowStockProductsResponse.body.products).to.be.an('array');
      expect(lowStockProductsResponse.body.products.length).to.be.greaterThan(0);
      
      const lowStockProduct = lowStockProductsResponse.body.products[0];
      expect(lowStockProduct).to.have.property('name', 'Test Low Stock Product');
      expect(lowStockProduct).to.have.property('quantity', 5);
      expect(lowStockProduct).to.have.property('minStockLevel', 10);
    });

    it('should show normal stock when quantity is above threshold', async function() {
      // Create a test user first
      const userResponse = await request(app)
        .post('/register')
        .send({
          email: 'testuser2@example.com',
          password: 'password123'
        });

      // Login to get session
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'testuser2@example.com',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Create a product with sufficient stock
      const productResponse = await request(app)
        .post('/products')
        .set('Cookie', cookies)
        .send({
          name: 'Test Normal Stock Product',
          sku: 'NSP001',
          quantity: 25,  // Above default minStockLevel of 10
          weight: 1.5,
          description: 'A product with normal stock levels'
        });

      // Check low stock count should be zero
      const lowStockCountResponse = await request(app)
        .get('/stock-intake/data/low-stock/count')
        .set('Cookie', cookies);

      console.log('Normal Stock Count Response:', lowStockCountResponse.body);
      expect(lowStockCountResponse.status).to.equal(200);
      expect(lowStockCountResponse.body).to.have.property('count', 0);

      // Check low stock products should be empty
      const lowStockProductsResponse = await request(app)
        .get('/stock-intake/data/low-stock/products')
        .set('Cookie', cookies);

      console.log('Normal Stock Products Response:', lowStockProductsResponse.body);
      expect(lowStockProductsResponse.status).to.equal(200);
      expect(lowStockProductsResponse.body).to.have.property('products');
      expect(lowStockProductsResponse.body.products).to.be.an('array');
      expect(lowStockProductsResponse.body.products).to.have.length(0);
    });
  });
});