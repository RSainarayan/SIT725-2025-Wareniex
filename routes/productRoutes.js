const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');

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

// Export products as PDF (must come before :id routes)
router.get('/export/pdf', async (req, res) => {
  try {
    const products = await Product.find();
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="products.pdf"');
    doc.pipe(res);
    doc.fontSize(20).text('Product Listing', { align: 'center' });
    doc.moveDown();
    // Table headers
    doc.fontSize(12).text('Name', 50, doc.y, { continued: true, width: 100 });
    doc.text('SKU', 150, doc.y, { continued: true, width: 80 });
    doc.text('Quantity', 230, doc.y, { continued: true, width: 80 });
    doc.text('Weight (kg)', 310, doc.y, { continued: true, width: 80 });
    doc.text('Location', 390, doc.y, { width: 100 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    // Table rows
    products.forEach(p => {
      doc.text(p.name || '', 50, doc.y, { continued: true, width: 100 });
      doc.text(p.sku || '', 150, doc.y, { continued: true, width: 80 });
      doc.text(p.quantity != null ? p.quantity : '', 230, doc.y, { continued: true, width: 80 });
      doc.text(p.weight != null ? p.weight : 0, 310, doc.y, { continued: true, width: 80 });
      doc.text(p.location || '', 390, doc.y, { width: 100 });
    });
    doc.end();
  } catch (err) {
    res.status(500).send('Error generating PDF');
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
