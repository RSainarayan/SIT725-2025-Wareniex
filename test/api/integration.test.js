require('../helpers/setup');
const { connectTestDB, disconnectTestDB } = require('../helpers/database');
const app = require('../../server');
const Product = require('../../models/Product');
const StockIntake = require('../../models/StockIntake');
const User = require('../../models/User');
const { 
  createTestUser, 
  createTestAdmin,
  createTestProduct, 
  createTestStockIntake, 
  authenticateUser, 
  cleanupTestData 
} = require('../helpers/testUtils');

describe('Integration Tests - Complete Workflows', () => {
  let adminCookie;
  let userCookie;
  let adminUser;
  let regularUser;

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
    
    // Create admin user
    adminUser = await createTestAdmin({
      email: 'admin@integration.com',
      password: 'admin123'
    });
    
    // Create regular user
    regularUser = await createTestUser({
      email: 'user@integration.com',
      password: 'user123',
      role: 'user'
    });
    
    // Authenticate both users
    adminCookie = await authenticateUser(app, {
      email: 'admin@integration.com',
      password: 'admin123'
    });
    
    userCookie = await authenticateUser(app, {
      email: 'user@integration.com',
      password: 'user123'
    });
  });

  describe('Complete Product Lifecycle', () => {
    it('should handle complete product creation, stock management, and updates', async () => {
      // Step 1: Create a new product
      const productData = {
        name: 'Integration Test Product',
        description: 'A product for testing complete workflows',
        code: 'ITP001',
        price: 99.99,
        stockQuantity: 0,
        stockWeight: 0
      };

      const createResponse = await chai.request(app)
        .post('/products')
        .set('Cookie', userCookie)
        .redirects(0)
        .send(productData);

      expect(createResponse.status).to.equal(302); // Redirect after creation
      
      // Verify product was created
      const createdProduct = await Product.findOne({ code: 'ITP001' });
      expect(createdProduct).to.not.be.null;
      expect(createdProduct.name).to.equal('Integration Test Product');
      expect(createdProduct.stockQuantity).to.equal(0);

      // Step 2: Add initial stock through stock intake
      const intakeData = {
        productId: createdProduct._id.toString(),
        quantity: 100,
        weight: 1000.00,
        notes: 'Initial stock delivery'
      };

      const intakeResponse = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(intakeData);

      expect(intakeResponse.status).to.equal(201);
      
      // Verify stock was updated
      const stockUpdatedProduct = await Product.findById(createdProduct._id);
      expect(stockUpdatedProduct.stockQuantity).to.equal(100);
      expect(stockUpdatedProduct.stockWeight).to.equal(1000.00);

      // Step 3: Add more stock
      const additionalIntakeData = {
        productId: createdProduct._id.toString(),
        quantity: 50,
        weight: 500.00,
        notes: 'Additional stock delivery'
      };

      const additionalIntakeResponse = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send(additionalIntakeData);

      expect(additionalIntakeResponse.status).to.equal(201);

      // Verify cumulative stock
      const finalProduct = await Product.findById(createdProduct._id);
      expect(finalProduct.stockQuantity).to.equal(150);
      expect(finalProduct.stockWeight).to.equal(1500.00);

      // Step 4: Update product details
      const updateData = {
        name: 'Updated Integration Product',
        price: 119.99
      };

      const updateResponse = await chai.request(app)
        .put(`/products/${createdProduct._id}`)
        .set('Cookie', userCookie)
        .send(updateData);

      expect(updateResponse.status).to.equal(200);
      expect(updateResponse.body.name).to.equal('Updated Integration Product');
      expect(updateResponse.body.price).to.equal(119.99);
      expect(updateResponse.body.stockQuantity).to.equal(150); // Stock should remain unchanged

      // Step 5: Verify all stock intake records
      const intakeRecords = await StockIntake.find({ productId: createdProduct._id });
      expect(intakeRecords).to.have.lengthOf(2);
      
      const totalIntakenQuantity = intakeRecords.reduce((sum, intake) => sum + intake.quantity, 0);
      expect(totalIntakenQuantity).to.equal(150);
    });

    it('should handle product deletion with existing stock intake records', async () => {
      // Create product and add stock
      const product = await createTestProduct({
        name: 'Product to Delete',
        code: 'PTD001'
      });

      await createTestStockIntake({
        productId: product._id,
        quantity: 25,
        weight: 250.00,
        notes: 'Stock before deletion'
      });

      // Delete the product
      const deleteResponse = await chai.request(app)
        .delete(`/products/${product._id}`)
        .set('Cookie', userCookie);

      expect(deleteResponse.status).to.equal(200);

      // Verify product is deleted
      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).to.be.null;

      // Verify stock intake records still exist but with null product reference
      const orphanedIntakes = await StockIntake.find({ productId: product._id });
      expect(orphanedIntakes).to.have.lengthOf(1);
    });
  });

  describe('User Management and Authorization Workflows', () => {
    it('should handle complete user registration and authentication flow', async () => {
      // Step 1: Register new user
      const newUserData = {
        email: 'newintegration@example.com',
        password: 'newpassword123',
        role: 'user'
      };

      const registerResponse = await chai.request(app)
        .post('/register')
        .redirects(0)
        .send(newUserData);

      expect(registerResponse.status).to.equal(302);
      expect(registerResponse.headers.location).to.equal('/login');

      // Verify user was created
      const createdUser = await User.findOne({ email: 'newintegration@example.com' });
      expect(createdUser).to.not.be.null;
      expect(createdUser.role).to.equal('user');

      // Step 2: Login with new user
      const loginResponse = await chai.request(app)
        .post('/login')
        .redirects(0)
        .send({
          email: 'newintegration@example.com',
          password: 'newpassword123'
        });

      expect(loginResponse.status).to.equal(302);
      expect(loginResponse.headers.location).to.equal('/dashboard');
      
      const newUserCookie = loginResponse.headers['set-cookie'];
      expect(newUserCookie).to.exist;

      // Step 3: Access protected resource
      const dashboardResponse = await chai.request(app)
        .get('/dashboard')
        .set('Cookie', newUserCookie);

      expect(dashboardResponse.status).to.equal(200);

      // Step 4: Verify user info endpoint
      const userInfoResponse = await chai.request(app)
        .get('/me')
        .set('Cookie', newUserCookie);

      expect(userInfoResponse.status).to.equal(200);
      expect(userInfoResponse.body.email).to.equal('newintegration@example.com');
      expect(userInfoResponse.body.role).to.equal('user');

      // Step 5: Logout
      const logoutResponse = await chai.request(app)
        .get('/logout')
        .redirects(0)
        .set('Cookie', newUserCookie);

      expect(logoutResponse.status).to.equal(302);
      expect(logoutResponse.headers.location).to.equal('/login');

      // Step 6: Verify access is denied after logout
      const postLogoutResponse = await chai.request(app)
        .get('/dashboard')
        .redirects(0)
        .set('Cookie', newUserCookie);

      expect(postLogoutResponse.status).to.equal(302);
      expect(postLogoutResponse.headers.location).to.equal('/login');
    });

    it('should handle admin user management workflows', async () => {
      // Step 1: Admin creates a new user
      const adminCreatedUserData = {
        email: 'admincreated@example.com',
        password: 'adminpassword123',
        role: 'user'
      };

      const createUserResponse = await chai.request(app)
        .post('/admin/users')
        .set('Cookie', adminCookie)
        .send(adminCreatedUserData);

      expect(createUserResponse.status).to.equal(201);
      expect(createUserResponse.body.email).to.equal('admincreated@example.com');

      const createdUserId = createUserResponse.body.id;

      // Step 2: Admin updates user role
      const updateUserData = {
        role: 'admin'
      };

      const updateUserResponse = await chai.request(app)
        .put(`/admin/users/${createdUserId}`)
        .set('Cookie', adminCookie)
        .send(updateUserData);

      expect(updateUserResponse.status).to.equal(200);
      expect(updateUserResponse.body.role).to.equal('admin');

      // Step 3: Verify user can now access admin endpoints
      const newAdminCookie = await authenticateUser(app, {
        email: 'admincreated@example.com',
        password: 'adminpassword123'
      });

      const adminAccessResponse = await chai.request(app)
        .get('/admin/users')
        .set('Cookie', newAdminCookie);

      expect(adminAccessResponse.status).to.equal(200);
      expect(adminAccessResponse.body).to.be.an('array');

      // Step 4: Admin deletes the user
      const deleteUserResponse = await chai.request(app)
        .delete(`/admin/users/${createdUserId}`)
        .set('Cookie', adminCookie);

      expect(deleteUserResponse.status).to.equal(200);

      // Step 5: Verify user is deleted
      const deletedUser = await User.findById(createdUserId);
      expect(deletedUser).to.be.null;
    });
  });

  describe('Cross-Feature Integration Scenarios', () => {
    it('should handle inventory management across multiple products and users', async () => {
      // Create multiple products
      const product1 = await createTestProduct({
        name: 'Multi Product 1',
        code: 'MP001',
        stockQuantity: 50
      });

      const product2 = await createTestProduct({
        name: 'Multi Product 2',
        code: 'MP002',
        stockQuantity: 75
      });

      // Multiple users add stock to different products
      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send({
          productId: product1._id.toString(),
          quantity: 25,
          weight: 250.00,
          notes: 'User stock addition'
        });

      await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', adminCookie)
        .send({
          productId: product2._id.toString(),
          quantity: 35,
          weight: 350.00,
          notes: 'Admin stock addition'
        });

      // Verify stock updates
      const updatedProduct1 = await Product.findById(product1._id);
      const updatedProduct2 = await Product.findById(product2._id);

      expect(updatedProduct1.stockQuantity).to.equal(75);
      expect(updatedProduct2.stockQuantity).to.equal(110);

      // Get all stock intake data
      const stockIntakeResponse = await chai.request(app)
        .get('/stock-intake/data')
        .set('Cookie', adminCookie);

      expect(stockIntakeResponse.status).to.equal(200);
      expect(stockIntakeResponse.body).to.have.lengthOf(2);

      // Verify populated product data
      const intakes = stockIntakeResponse.body;
      const product1Intake = intakes.find(intake => intake.productId.code === 'MP001');
      const product2Intake = intakes.find(intake => intake.productId.code === 'MP002');

      expect(product1Intake).to.exist;
      expect(product1Intake.quantity).to.equal(25);
      expect(product2Intake).to.exist;
      expect(product2Intake.quantity).to.equal(35);
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const product = await createTestProduct({
        name: 'Concurrency Test Product',
        code: 'CTP001',
        stockQuantity: 100
      });

      // Simulate concurrent stock additions and product updates
      const stockAddition1 = chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send({
          productId: product._id.toString(),
          quantity: 10,
          weight: 100.00,
          notes: 'Concurrent addition 1'
        });

      const stockAddition2 = chai.request(app)
        .post('/stock-intake')
        .set('Cookie', adminCookie)
        .send({
          productId: product._id.toString(),
          quantity: 15,
          weight: 150.00,
          notes: 'Concurrent addition 2'
        });

      const productUpdate = chai.request(app)
        .put(`/products/${product._id}`)
        .set('Cookie', adminCookie)
        .send({
          name: 'Updated Concurrency Product',
          price: 199.99
        });

      // Wait for all operations to complete
      const [intake1Response, intake2Response, updateResponse] = await Promise.all([
        stockAddition1,
        stockAddition2,
        productUpdate
      ]);

      // Verify all operations succeeded
      expect(intake1Response.status).to.equal(201);
      expect(intake2Response.status).to.equal(201);
      expect(updateResponse.status).to.equal(200);

      // Verify final state
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct.name).to.equal('Updated Concurrency Product');
      expect(finalProduct.price).to.equal(199.99);
      expect(finalProduct.stockQuantity).to.equal(125); // 100 + 10 + 15

      const allIntakes = await StockIntake.find({ productId: product._id });
      expect(allIntakes).to.have.lengthOf(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cascading deletions properly', async () => {
      const product = await createTestProduct({
        name: 'Cascade Test Product',
        code: 'CTP002'
      });

      // Add multiple stock intake records
      await createTestStockIntake({
        productId: product._id,
        quantity: 10,
        weight: 100.00,
        notes: 'First intake'
      });

      await createTestStockIntake({
        productId: product._id,
        quantity: 20,
        weight: 200.00,
        notes: 'Second intake'
      });

      // Delete the product
      const deleteResponse = await chai.request(app)
        .delete(`/products/${product._id}`)
        .set('Cookie', userCookie);

      expect(deleteResponse.status).to.equal(200);

      // Verify product is gone
      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).to.be.null;

      // Stock intake records should still exist but orphaned
      const orphanedIntakes = await StockIntake.find({ productId: product._id });
      expect(orphanedIntakes).to.have.lengthOf(2);
    });

    it('should handle invalid data gracefully across endpoints', async () => {
      // Invalid product creation
      const invalidProductResponse = await chai.request(app)
        .post('/products')
        .set('Cookie', userCookie)
        .send({
          name: '', // Invalid name
          price: -10 // Invalid price
        });

      expect(invalidProductResponse.status).to.be.oneOf([400, 500]);

      // Invalid stock intake
      const invalidIntakeResponse = await chai.request(app)
        .post('/stock-intake')
        .set('Cookie', userCookie)
        .send({
          productId: 'invalid-id',
          quantity: -5
        });

      expect(invalidIntakeResponse.status).to.equal(400);

      // Invalid user creation
      const invalidUserResponse = await chai.request(app)
        .post('/admin/users')
        .set('Cookie', adminCookie)
        .send({
          email: 'not-an-email',
          password: '123' // Too short
        });

      expect(invalidUserResponse.status).to.be.oneOf([400, 500]);
    });

    it('should handle authentication failures gracefully', async () => {
      // Access protected endpoints without authentication
      const endpoints = [
        { method: 'get', path: '/dashboard' },
        { method: 'get', path: '/products/data' },
        { method: 'post', path: '/products' },
        { method: 'get', path: '/stock-intake/data' },
        { method: 'post', path: '/stock-intake' },
        { method: 'get', path: '/admin/users' }
      ];

      for (const endpoint of endpoints) {
        const response = await chai.request(app)[endpoint.method](endpoint.path)
          .redirects(0);

        // Should either redirect to login (302) or return unauthorized (401)
        expect(response.status).to.be.oneOf([302, 401]);
        
        if (response.status === 302) {
          expect(response.headers.location).to.equal('/login');
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // Create multiple products
      const productPromises = Array(10).fill().map((_, index) =>
        createTestProduct({
          name: `Bulk Product ${index}`,
          code: `BP${String(index).padStart(3, '0')}`,
          price: 10 + index
        })
      );

      const products = await Promise.all(productPromises);

      // Add stock to all products
      const intakePromises = products.map(product =>
        chai.request(app)
          .post('/stock-intake')
          .set('Cookie', userCookie)
          .send({
            productId: product._id.toString(),
            quantity: 100,
            weight: 1000.00,
            notes: `Bulk stock for ${product.name}`
          })
      );

      const intakeResponses = await Promise.all(intakePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all operations succeeded
      intakeResponses.forEach(response => {
        expect(response.status).to.equal(201);
      });

      // Performance check - should complete within reasonable time
      expect(duration).to.be.lessThan(10000); // Less than 10 seconds

      // Verify final state
      const allProducts = await Product.find({ name: /^Bulk Product/ });
      expect(allProducts).to.have.lengthOf(10);
      
      allProducts.forEach(product => {
        expect(product.stockQuantity).to.equal(100);
      });

      const allIntakes = await StockIntake.find({});
      expect(allIntakes.length).to.be.at.least(10);
    });
  });
});