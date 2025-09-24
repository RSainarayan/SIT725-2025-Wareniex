const Product = require('../models/Product');
const path = require('path');

// API: list products as JSON
exports.apiIndex = async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  res.json(products);
};

// API: single product JSON
exports.apiShow = async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
};

// API: get total quantity of all products
exports.apiTotalQuantity = async (req, res) => {
  try {
    // Use aggregation to ensure numeric sum on the database side
    const result = await Product.aggregate([
      { $group: { _id: null, totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } } } }
    ]);
    const totalQuantity = (result && result[0] && result[0].totalQuantity) ? result[0].totalQuantity : 0;
    res.json({ totalQuantity });
  } catch (err) {
    console.error('Error computing total quantity', err);
    res.status(500).json({ totalQuantity: 0 });
  }
};

// Serve static HTML pages from views folder (if needed elsewhere)
exports.pageNew = (req, res) => {
  res.render('products/new');
};

exports.pageIndex = async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  res.render('products/index', { products });
};

exports.pageShow = async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) return res.status(404).send('Product not found');
  res.render('products/show', { product });
};

exports.create = async (req, res) => {
  let { name, sku, quantity, location, weight } = req.body;
  console.log('Received weight:', weight); // Debug log
  // Convert weight to number, allow 0 and decimals
  weight = weight === '' || weight === undefined ? null : parseFloat(weight);
  try {
    await Product.create({ name, sku, quantity, location, weight });
    req.app.get('io').emit('productCreated', { name, sku, quantity, location, weight });
    res.redirect('/products');
  } catch (err) {
    res.status(400).send('Error creating product: ' + err.message);
  }
};

exports.delete = async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  req.app.get('io').emit('productDeleted', { _id: req.params.id });
  res.redirect('/dashboard.html');
};
