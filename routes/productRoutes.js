const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Product = require('../models/Product');

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

// Export products as CSV (must come before :id routes)
router.get('/export/csv', async (req, res) => {
  try {
    const products = await Product.find();
    const headers = ['Name','SKU','Quantity','Weight (kg)','Location'];
    const rows = products.map(p => [
      p.name,
      p.sku,
      p.quantity,
      p.weight != null ? p.weight : 0,
      p.location || ''
    ]);
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(x => '"'+x+'"').join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).send('Error generating CSV');
  }
});

// Page-specific route (must come after API routes to avoid conflict)
router.get('/:id', productController.pageShow);
router.get('/:id/edit', productController.pageEdit);

// Create / delete use traditional form posts
router.post('/', productController.create);
router.post('/:id/delete', productController.delete);
router.post('/:id/edit', productController.edit);

module.exports = router;
