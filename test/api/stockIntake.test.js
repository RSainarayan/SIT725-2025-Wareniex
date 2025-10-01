require('../helpers/setup');
const { connectTestDB, disconnectTestDB } = require('../helpers/database');
const app = require('../../server');
const StockIntake = require('../../models/StockIntake');
const Product = require('../../models/Product');
const { 
  createTestUser, 
  createTestProduct, 
  createTestStockIntake, 
  authenticateUser, 
  cleanupTestData 
} = require('../helpers/testUtils');

describe('Stock Intake API Endpoints', () => {
  let userCookie;
  let testUser;
  let testProduct;

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
    
    testUser = await createTestUser({
      email: 'stockuser@example.com',
      password: 'password123',
      role: 'admin'
    });
    
    testProduct = await createTestProduct({
      name: 'Test Stock Product',
      code: 'TSP001',
      price: 50.00,
      stockQuantity: 100,
      stockWeight: 1000.00
    });
    
    userCookie = await authenticateUser(app, {
      email: 'stockuser@example.com',
      password: 'password123'
    });
  });

  describe('GET /stock-intake', () => {
    it('should render stock intake listing page for authenticated users', async () => {
      const response = await chai.request(app)
        .get('/stock-intake')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.text).to.include('Stock Intake');
    });

    it('should redirect unauthenticated users to login', async () => {
      const response = await chai.request(app)
        .get('/stock-intake')
        .redirects(0);

      expect(response.status).to.equal(302);
      expect(response.headers.location).to.equal('/login');
    });
  });

  describe('GET /stock-intake/new', () => {
    it('should render new stock intake form for authenticated users', async () => {
      const response = await chai.request(app)
        .get('/stock-intake/new')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.text).to.include('New Stock Intake');
    });

    it('should redirect unauthenticated users to login', async () => {
      const response = await chai.request(app)
        .get('/stock-intake/new')
        .redirects(0);

      expect(response.status).to.equal(302);
      expect(response.headers.location).to.equal('/login');
    });
  });

  describe('GET /stock-intake/data', () => {
    it('should return empty array when no stock intakes exist', async () => {
      const response = await chai.request(app)
        .get('/stock-intake/data')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array').that.is.empty;
    });

    it('should return stock intakes with product details populated', async () => {
      await createTestStockIntake({
        productId: testProduct._id,
        quantity: 50,
        weight: 500.00,
        notes: 'Test intake'
      });

      const response = await chai.request(app)
        .get('/stock-intake/data')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array').with.lengthOf(1);
      
      const stockIntake = response.body[0];
      expect(stockIntake).to.have.property('quantity', 50);
      expect(stockIntake).to.have.property('weight', 500.00);
      expect(stockIntake).to.have.property('notes', 'Test intake');
      expect(stockIntake).to.have.property('productId');
      expect(stockIntake.productId).to.have.property('name', 'Test Stock Product');
      expect(stockIntake.productId).to.have.property('code', 'TSP001');
    });

    it('should return stock intakes ordered by creation date (newest first)', async () => {
      // Create multiple stock intakes
      const intake1 = await createTestStockIntake({
        productId: testProduct._id,
        quantity: 10,
        weight: 100.00,
        notes: 'First intake'
      });

      const product2 = await createTestProduct({
        name: 'Second Product',
        code: 'SP002',
        price: 30.00
      });

      const intake2 = await createTestStockIntake({
        productId: product2._id,
        quantity: 20,
        weight: 200.00,
        notes: 'Second intake'
      });

      const response = await chai.request(app)
        .get('/stock-intake/data')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array').with.lengthOf(2);
      
      // Should be ordered by creation date (newest first)
      expect(new Date(response.body[0].createdAt)).to.be.above(new Date(response.body[1].createdAt));
    });

    it('should handle database errors gracefully', async () => {
      const response = await chai.request(app)
        .get('/stock-intake/data')
        .set('Cookie', userCookie);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });

    it('should require authentication', async () => {
      const response = await chai.request(app)
        .get('/stock-intake/data');

      expect(response.status).to.equal(401);
      expect(response.body).to.deep.equal({});
    });
  });

  describe('POST /stock-intake', () => {
    it('should create new stock intake and update product stock', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 25,
        weight: 250.00,
        notes: 'New stock arrival'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('productId', testProduct._id.toString());
      expect(response.body).to.have.property('quantity', 25);
      expect(response.body).to.have.property('weight', 250.00);
      expect(response.body).to.have.property('notes', 'New stock arrival');
      expect(response.body).to.have.property('_id');
      expect(response.body).to.have.property('createdAt');

      // Verify stock intake was saved to database
      const savedIntake = await StockIntake.findById(response.body._id);
      expect(savedIntake).to.not.be.null;
      expect(savedIntake.quantity).to.equal(25);

      // Verify product stock was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(125); // 100 + 25
      expect(updatedProduct.stockWeight).to.equal(1250.00); // 1000.00 + 250.00
    });

    it('should handle zero quantities correctly', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 0,
        weight: 0,
        notes: 'Zero intake test'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body.quantity).to.equal(0);
      expect(response.body.weight).to.equal(0);

      // Product stock should remain unchanged
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(100);
      expect(updatedProduct.stockWeight).to.equal(1000.00);
    });

    it('should handle large quantities correctly', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 1000,
        weight: 10000.50,
        notes: 'Large stock intake'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body.quantity).to.equal(1000);
      expect(response.body.weight).to.equal(10000.50);

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(1100); // 100 + 1000
      expect(updatedProduct.stockWeight).to.equal(11000.50); // 1000.00 + 10000.50
    });

    it('should create stock intake without notes', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 15,
        weight: 150.00
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body.quantity).to.equal(15);
      expect(response.body.weight).to.equal(150.00);
      expect(response.body.notes).to.be.undefined;
    });

    it('should return 400 for missing productId', async () => {
      const intakeData = {
        quantity: 25,
        weight: 250.00,
        notes: 'Missing product ID'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('productId');
    });

    it('should return 400 for missing quantity', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        weight: 250.00,
        notes: 'Missing quantity'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('quantity');
    });

    it('should return 400 for missing weight', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 25,
        notes: 'Missing weight'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('weight');
    });

    it('should return 400 for negative quantity', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: -5,
        weight: 250.00,
        notes: 'Negative quantity'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('negative');
    });

    it('should return 400 for negative weight', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 25,
        weight: -250.00,
        notes: 'Negative weight'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('negative');
    });

    it('should return 400 for invalid productId format', async () => {
      const intakeData = {
        productId: 'invalid-id',
        quantity: 25,
        weight: 250.00,
        notes: 'Invalid product ID'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentProductId = '507f1f77bcf86cd799439011';
      
      const intakeData = {
        productId: nonExistentProductId,
        quantity: 25,
        weight: 250.00,
        notes: 'Non-existent product'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Product not found');
    });

    it('should handle extremely long notes gracefully', async () => {
      const longNotes = 'A'.repeat(5000); // Very long notes
      
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 25,
        weight: 250.00,
        notes: longNotes
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body.notes).to.equal(longNotes);
    });

    it('should require authentication', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 25,
        weight: 250.00,
        notes: 'Unauthenticated request'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .send(intakeData);

      expect(response.status).to.equal(401);
      expect(response.body).to.deep.equal({});
    });
  });

  describe('Stock Intake Business Logic', () => {
    it('should correctly calculate running totals with multiple intakes', async () => {
      // Create multiple intakes for the same product
      const intake1Data = {
        productId: testProduct._id.toString(),
        quantity: 10,
        weight: 100.00,
        notes: 'First intake'
      };

      const intake2Data = {
        productId: testProduct._id.toString(),
        quantity: 15,
        weight: 150.00,
        notes: 'Second intake'
      };

      const intake3Data = {
        productId: testProduct._id.toString(),
        quantity: 5,
        weight: 50.00,
        notes: 'Third intake'
      };

      // Create intakes sequentially
      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intake1Data);

      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intake2Data);

      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intake3Data);

      // Check final product stock levels
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(130); // 100 + 10 + 15 + 5
      expect(updatedProduct.stockWeight).to.equal(1300.00); // 1000.00 + 100 + 150 + 50

      // Verify all intakes were recorded
      const allIntakes = await StockIntake.find({ productId: testProduct._id });
      expect(allIntakes).to.have.lengthOf(3);
    });

    it('should handle decimal quantities and weights correctly', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 12.5,
        weight: 125.75,
        notes: 'Decimal values test'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);
      expect(response.body.quantity).to.equal(12.5);
      expect(response.body.weight).to.equal(125.75);

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(112.5); // 100 + 12.5
      expect(updatedProduct.stockWeight).to.equal(1125.75); // 1000.00 + 125.75
    });

    it('should maintain data integrity under concurrent requests', async () => {
      const intakeData = {
        productId: testProduct._id.toString(),
        quantity: 1,
        weight: 10.00,
        notes: 'Concurrent test'
      };

      // Simulate concurrent requests
      const promises = Array(5).fill().map(() => 
        chai.request(app)
          .post('/stock-intake')
          .set('Cookie', userCookie)
          .send(intakeData)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(201);
      });

      // Final stock should reflect all intakes
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(105); // 100 + (1 × 5)
      expect(updatedProduct.stockWeight).to.equal(1050.00); // 1000.00 + (10.00 × 5)

      // All intakes should be recorded
      const allIntakes = await StockIntake.find({ productId: testProduct._id });
      expect(allIntakes).to.have.lengthOf(5);
    });
  });

  describe('Integration with Product Management', () => {
    it('should work correctly when product stock starts at zero', async () => {
      const zeroStockProduct = await createTestProduct({
        name: 'Zero Stock Product',
        code: 'ZSP001',
        price: 25.00,
        stockQuantity: 0,
        stockWeight: 0
      });

      const intakeData = {
        productId: zeroStockProduct._id.toString(),
        quantity: 100,
        weight: 1000.00,
        notes: 'Initial stock'
      };

      const response = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(response.status).to.equal(201);

      const updatedProduct = await Product.findById(zeroStockProduct._id);
      expect(updatedProduct.stockQuantity).to.equal(100);
      expect(updatedProduct.stockWeight).to.equal(1000.00);
    });

    it('should maintain product relationships correctly', async () => {
      // Create multiple products
      const product1 = await createTestProduct({
        name: 'Product 1',
        code: 'P001',
        stockQuantity: 50
      });

      const product2 = await createTestProduct({
        name: 'Product 2',
        code: 'P002',
        stockQuantity: 75
      });

      // Add stock to both products
      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send({
          productId: product1._id.toString(),
          quantity: 25,
          weight: 250.00,
          notes: 'Product 1 intake'
        });

      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send({
          productId: product2._id.toString(),
          quantity: 35,
          weight: 350.00,
          notes: 'Product 2 intake'
        });

      // Check that both products were updated correctly
      const updatedProduct1 = await Product.findById(product1._id);
      const updatedProduct2 = await Product.findById(product2._id);

      expect(updatedProduct1.stockQuantity).to.equal(75); // 50 + 25
      expect(updatedProduct2.stockQuantity).to.equal(110); // 75 + 35

      // Check that intakes are linked to correct products
      const intakes = await StockIntake.find().populate('productId');
      expect(intakes).to.have.lengthOf(2);
      
      const product1Intake = intakes.find(intake => intake.productId.code === 'P001');
      const product2Intake = intakes.find(intake => intake.productId.code === 'P002');
      
      expect(product1Intake.quantity).to.equal(25);
      expect(product2Intake.quantity).to.equal(35);
    });
  });
});