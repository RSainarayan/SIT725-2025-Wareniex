const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// API endpoints for client-side JS
router.get('/data', productController.apiIndex);
router.get('/data/total-quantity', productController.apiTotalQuantity);
router.get('/data/:id', productController.apiShow);

// Pages (static HTML served)
router.get('/', productController.pageIndex);
router.get('/new', productController.pageNew);

// API endpoints for client-side JS (register before ':id' routes)
router.get('/data', productController.apiIndex);
router.get('/data/:id', productController.apiShow);
// API endpoint for total quantity
router.get('/data/total-quantity', productController.apiTotalQuantity);

// Page-specific route (must come after API routes to avoid conflict)
router.get('/:id', productController.pageShow);
router.get('/:id/edit', productController.pageEdit);

// Create / delete use traditional form posts
router.post('/', productController.create);
router.post('/:id/delete', productController.delete);
router.post('/:id/edit', productController.edit);

module.exports = router;
