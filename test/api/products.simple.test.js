require('../helpers/setup');
const { connectTestDB, disconnectTestDB } = require('../helpers/database');
const app = require('../../server');
const Product = require('../../models/Product');
const { 
  createTestProduct, 
  cleanupTestData 
} = require('../helpers/testUtils');

describe('Product API Tests (Working Version)', () => {
  
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

    it('should return all products', async () => {
      await createTestProduct({ 
        name: 'Product 1', 
        sku: 'PROD-001',
        quantity: 5 
      });
      
      await createTestProduct({ 
        name: 'Product 2', 
        sku: 'PROD-002',
        quantity: 10 
      });

      const response = await chai.request(app)
        .get('/products/data');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(2);
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
        .redirects(0) // Don't follow redirects
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
  });
});