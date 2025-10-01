require('../helpers/setup');
const { connectTestDB, disconnectTestDB } = require('../helpers/database');
const app = require('../../server');
const Product = require('../../models/Product');
const { 
  createTestProduct, 
  createTestUser, 
  authenticateUser, 
  cleanupTestData 
} = require('../helpers/testUtils');

describe('Product API Endpoints', () => {
  
  before(async function() {
    this.timeout(30000);
    await connectTestDB();
  });

  after(async function() {
    this.timeout(30000);
    await disconnectTestDB();
  });
  
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('GET /products/data', () => {
    it('should return an empty array when no products exist', async () => {
      const response = await chai.request(app)
        .get('/products/data');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return all products sorted by creation date', async () => {
      // Create test products
      const product1 = await createTestProduct({ 
        name: 'Product 1', 
        sku: 'PROD-001',
        quantity: 5 
      });
      
      const product2 = await createTestProduct({ 
        name: 'Product 2', 
        sku: 'PROD-002',
        quantity: 10 
      });

      const response = await chai.request(app)
        .get('/products/data');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(2);
      
      // Check that products are returned (newer first due to sort)
      expect(response.body[0].name).to.equal('Product 2');
      expect(response.body[1].name).to.equal('Product 1');
      
      // Verify all required fields are present
      response.body.forEach(product => {
        expect(product).to.have.property('_id');
        expect(product).to.have.property('name');
        expect(product).to.have.property('sku');
        expect(product).to.have.property('quantity');
        expect(product).to.have.property('location');
        expect(product).to.have.property('weight');
        expect(product).to.have.property('createdAt');
        expect(product).to.have.property('updatedAt');
      });
    });
  });

  describe('GET /products/data/:id', () => {
    it('should return a specific product by ID', async () => {
      const product = await createTestProduct({
        name: 'Test Product',
        sku: 'TEST-123',
        quantity: 15,
        location: 'Warehouse B',
        weight: 2.5
      });

      const response = await chai.request(app)
        .get(`/products/data/${product._id}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body._id).to.equal(product._id.toString());
      expect(response.body.name).to.equal('Test Product');
      expect(response.body.sku).to.equal('TEST-123');
      expect(response.body.quantity).to.equal(15);
      expect(response.body.location).to.equal('Warehouse B');
      expect(response.body.weight).to.equal(2.5);
    });

    it('should return 404 for non-existent product ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await chai.request(app)
        .get(`/products/data/${nonExistentId}`);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Product not found');
    });

    it('should return 404 for invalid product ID format', async () => {
      const invalidId = 'invalid-id';
      
      const response = await chai.request(app)
        .get(`/products/data/${invalidId}`);

      expect(response.status).to.equal(404);
    });
  });

  describe('GET /products/data/total-quantity', () => {
    it('should return 0 total quantity when no products exist', async () => {
      const response = await chai.request(app)
        .get('/products/data/total-quantity');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('totalQuantity');
      expect(response.body.totalQuantity).to.equal(0);
    });

    it('should return correct total quantity for multiple products', async () => {
      await createTestProduct({ sku: 'SKU-1', quantity: 10 });
      await createTestProduct({ sku: 'SKU-2', quantity: 15 });
      await createTestProduct({ sku: 'SKU-3', quantity: 20 });

      const response = await chai.request(app)
        .get('/products/data/total-quantity');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('totalQuantity');
      expect(response.body.totalQuantity).to.equal(45);
    });

    it('should handle products with null or undefined quantities', async () => {
      await createTestProduct({ sku: 'SKU-A', quantity: 10 });
      await createTestProduct({ sku: 'SKU-B', quantity: null });

      const response = await chai.request(app)
        .get('/products/data/total-quantity');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('totalQuantity');
      expect(response.body.totalQuantity).to.equal(10);
    });
  });

  describe('POST /products', () => {
    it('should create a new product with valid data', async () => {
      const productData = {
        name: 'New Product',
        sku: 'NEW-001',
        quantity: 25,
        location: 'Warehouse C',
        weight: 3.0
      };

      const response = await chai.request(app)
        .post('/products')
        .send(productData);

      expect(response.status).to.equal(302); // Redirect after creation

      // Verify product was created in database
      const createdProduct = await Product.findOne({ sku: 'NEW-001' });
      expect(createdProduct).to.not.be.null;
      expect(createdProduct.name).to.equal('New Product');
      expect(createdProduct.quantity).to.equal(25);
      expect(createdProduct.location).to.equal('Warehouse C');
      expect(createdProduct.weight).to.equal(3.0);
    });

    it('should handle empty weight field', async () => {
      const productData = {
        name: 'Product No Weight',
        sku: 'NO-WEIGHT-001',
        quantity: 10,
        location: 'Warehouse D',
        weight: ''
      };

      const response = await chai.request(app)
        .post('/products')
        .send(productData);

      expect(response.status).to.equal(302);

      const createdProduct = await Product.findOne({ sku: 'NO-WEIGHT-001' });
      expect(createdProduct).to.not.be.null;
      expect(createdProduct.weight).to.be.null;
    });

    it('should return error for duplicate SKU', async () => {
      await createTestProduct({ sku: 'DUPLICATE-SKU' });

      const duplicateProduct = {
        name: 'Duplicate Product',
        sku: 'DUPLICATE-SKU',
        quantity: 10,
        location: 'Warehouse E'
      };

      const response = await chai.request(app)
        .post('/products')
        .send(duplicateProduct);

      expect(response.status).to.equal(400);
      expect(response.text).to.include('Error creating product');
    });
  });

  describe('POST /products/:id/edit', () => {
    it('should update an existing product', async () => {
      const product = await createTestProduct({
        name: 'Original Product',
        sku: 'ORIGINAL-001',
        quantity: 10
      });

      const updateData = {
        name: 'Updated Product',
        sku: 'UPDATED-001',
        quantity: 20,
        location: 'New Location',
        weight: 5.0
      };

      const response = await chai.request(app)
        .post(`/products/${product._id}/edit`)
        .send(updateData);

      expect(response.status).to.equal(302); // Redirect after update

      // Verify product was updated
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.name).to.equal('Updated Product');
      expect(updatedProduct.sku).to.equal('UPDATED-001');
      expect(updatedProduct.quantity).to.equal(20);
      expect(updatedProduct.location).to.equal('New Location');
      expect(updatedProduct.weight).to.equal(5.0);
    });

    it('should handle empty weight in update', async () => {
      const product = await createTestProduct();

      const updateData = {
        name: 'Updated Product',
        sku: 'UPDATED-002',
        quantity: 15,
        weight: ''
      };

      const response = await chai.request(app)
        .post(`/products/${product._id}/edit`)
        .send(updateData);

      expect(response.status).to.equal(302);

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.weight).to.be.null;
    });
  });

  describe('POST /products/:id/delete', () => {
    it('should delete an existing product', async () => {
      const product = await createTestProduct();

      const response = await chai.request(app)
        .post(`/products/${product._id}/delete`);

      expect(response.status).to.equal(302); // Redirect after deletion

      // Verify product was deleted
      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).to.be.null;
    });

    it('should handle deletion of non-existent product gracefully', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await chai.request(app)
        .post(`/products/${nonExistentId}/delete`);

      expect(response.status).to.equal(302); // Should still redirect even if product doesn't exist
    });
  });

  describe('GET /products/', () => {
    it('should render products index page', async () => {
      await createTestProduct({ name: 'Test Product 1', sku: 'TP-1' });
      await createTestProduct({ name: 'Test Product 2', sku: 'TP-2' });

      const response = await chai.request(app)
        .get('/products/');

      expect(response.status).to.equal(200);
      expect(response.text).to.include('Test Product 1');
      expect(response.text).to.include('Test Product 2');
    });
  });

  describe('GET /products/new', () => {
    it('should render new product form', async () => {
      const response = await chai.request(app)
        .get('/products/new');

      expect(response.status).to.equal(200);
      expect(response.text).to.include('form');
    });
  });

  describe('GET /products/:id', () => {
    it('should render product show page', async () => {
      const product = await createTestProduct({
        name: 'Show Test Product',
        sku: 'SHOW-001'
      });

      const response = await chai.request(app)
        .get(`/products/${product._id}`);

      expect(response.status).to.equal(200);
      expect(response.text).to.include('Show Test Product');
      expect(response.text).to.include('SHOW-001');
    });

    it('should return 404 for non-existent product show page', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await chai.request(app)
        .get(`/products/${nonExistentId}`);

      expect(response.status).to.equal(404);
    });
  });

  describe('GET /products/:id/edit', () => {
    it('should render product edit form', async () => {
      const product = await createTestProduct({
        name: 'Edit Test Product',
        sku: 'EDIT-001'
      });

      const response = await chai.request(app)
        .get(`/products/${product._id}/edit`);

      expect(response.status).to.equal(200);
      expect(response.text).to.include('Edit Test Product');
      expect(response.text).to.include('EDIT-001');
      expect(response.text).to.include('form');
    });

    it('should return 404 for non-existent product edit page', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const response = await chai.request(app)
        .get(`/products/${nonExistentId}/edit`);

      expect(response.status).to.equal(404);
    });
  });
});