const chai = require('chai');
const chaiHttp = require('chai-http');

// Configure chai
chai.use(chaiHttp);
global.expect = chai.expect;
global.chai = chai;

// Set environment to test
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key';
process.env.MONGO_URI = 'test-db-will-be-overridden';