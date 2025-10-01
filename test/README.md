# Testing Setup for Wareniex

This project uses Mocha and Chai for comprehensive API testing.

## Test Structure

```
test/
├── helpers/
│   ├── setup.js          # Global test setup and configuration
│   ├── database.js       # Test database utilities
│   └── testUtils.js      # Helper functions for creating test data
└── api/
    ├── products.test.js  # Product API endpoint tests
    ├── stockIntake.test.js # Stock intake API endpoint tests
    ├── auth.test.js      # Authentication and user management tests
    └── integration.test.js # Integration tests for complete workflows
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Features

### Database Testing
- Uses MongoDB Memory Server for isolated test environment
- Automatic database cleanup between tests
- No interference with development/production databases

### Authentication Testing
- User registration and login flows
- Session management
- Admin user management endpoints
- Authentication middleware protection

### Product API Testing
- CRUD operations for products
- Data validation and error handling
- Total quantity calculations
- Form submissions and redirects

### Stock Intake API Testing
- Stock intake creation with weight calculations
- Product quantity updates
- Data validation and error scenarios
- Populated product data in responses

### Integration Testing
- Complete warehouse management workflows
- End-to-end user management flows
- Multi-product scenarios with complex calculations
- Authentication flows from registration to logout

## Test Data Management

The test suite includes utilities for:
- Creating test users (regular and admin)
- Creating test products with various configurations
- Creating test stock intakes
- User authentication for protected endpoints
- Database cleanup between tests

## Coverage Requirements

- Lines: 80%
- Functions: 80%
- Branches: 70%
- Statements: 80%

## Test Configuration

- Timeout: 10 seconds per test
- Test database: In-memory MongoDB
- Environment: Isolated test environment
- Session management: Test-specific sessions