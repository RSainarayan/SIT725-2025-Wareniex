const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockIntakeController');
const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

router.get('/', ctrl.pageIndex);
router.get('/new', ctrl.pageNew);
router.post('/', ctrl.create);
router.post('/:id/delete', ctrl.delete);

// API
router.get('/data', ctrl.apiIndex);
router.get('/data/:id', ctrl.apiShow);

// Barcode image route for stock intake
router.get('/:id/barcode', async (req, res) => {
  try {
    const intake = await ctrl.apiShowRaw(req, res, true); // get raw intake
    if (!intake || !intake._id) return; // already handled
    // Use intake._id as barcode data
    bwipjs.toBuffer({
      bcid: 'code128',
      text: intake._id.toString(),
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    }, (err, png) => {
      if (err) return res.status(500).send('Barcode error');
      res.set('Content-Type', 'image/png');
      res.send(png);
    });
  } catch (err) {
    res.status(500).send('Barcode error');
  }
});

// Export stock intake as PDF
router.get('/export/pdf', async (req, res) => {
  try {
    const intakes = await ctrl.apiIndexRaw(req, res, true); // get all intakes
    // Generate all barcode images first
    const barcodeBuffers = await Promise.all(intakes.map(i =>
      new Promise(resolve => {
        bwipjs.toBuffer({
          bcid: 'code128',
          text: i._id.toString(),
          scale: 1,
          height: 10,
          includetext: false
        }, (err, png) => {
          resolve(!err ? png : null);
        });
      })
    ));
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-intake.pdf"');
    doc.pipe(res);
    doc.fontSize(20).text('Stock Intake Records', { align: 'center' });
    doc.moveDown();
    // Table headers
    doc.fontSize(12).text('Product', 50, doc.y, { continued: true, width: 120 });
    doc.text('Quantity', 170, doc.y, { continued: true, width: 60 });
    doc.text('Total Weight', 230, doc.y, { continued: true, width: 80 });
    doc.text('Unit Weight', 310, doc.y, { continued: true, width: 80 });
    doc.text('Received At', 390, doc.y, { continued: true, width: 140 });
    doc.text('Barcode', 530, doc.y, { width: 100 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(630, doc.y).stroke();
    // Table rows
    let y = doc.y;
    for (let i = 0; i < intakes.length; i++) {
      const intake = intakes[i];
      doc.text(intake.product && intake.product.name ? intake.product.name : 'Unknown', 50, y, { continued: true, width: 120 });
      doc.text(intake.quantity != null ? intake.quantity : '', 170, y, { continued: true, width: 60 });
      doc.text(intake.totalWeight != null ? intake.totalWeight : '', 230, y, { continued: true, width: 80 });
      doc.text(intake.singleWeight != null ? intake.singleWeight : '', 310, y, { continued: true, width: 80 });
      doc.text(intake.receivedAt ? new Date(intake.receivedAt).toLocaleString() : '', 390, y, { continued: true, width: 140 });
      if (barcodeBuffers[i]) {
        doc.image(barcodeBuffers[i], 530, y, { width: 80, height: 20 });
      }
      y = doc.y + 30;
      doc.moveDown();
    }
    doc.end();
  } catch (err) {
    res.status(500).send('Error generating PDF');
  }
});

module.exports = router;
