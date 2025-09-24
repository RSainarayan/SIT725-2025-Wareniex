const StockIntake = require('../models/StockIntake');
const Product = require('../models/Product');

// Render list page
exports.pageIndex = async (req, res) => {
  const intakes = await StockIntake.find().populate('product').sort({ createdAt: -1 });
  res.render('stock-intake/index', { intakes });
};

// Render new intake form
exports.pageNew = async (req, res) => {
  const products = await Product.find();
  res.render('stock-intake/new', { products });
};

// Create intake from totalWeight -> calculated quantity
exports.create = async (req, res) => {
  try {
    const { product: productId, totalWeight, receivedBy } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(400).send('Product not found');

    const parsedTotal = Number(totalWeight);
    if (isNaN(parsedTotal) || parsedTotal <= 0) return res.status(400).send('Invalid total weight');

    if (!product.weight || product.weight <= 0) {
      return res.status(400).send('Selected product does not have a valid unit weight configured');
    }

    const calculatedQty = Math.floor(parsedTotal / product.weight);

    const intake = new StockIntake({
      product: productId,
      quantity: calculatedQty,
      totalWeight: parsedTotal,
      singleWeight: product.weight,
      receivedBy: receivedBy || (req.user ? req.user.email : 'system')
    });
    await intake.save();

    product.quantity = (product.quantity || 0) + calculatedQty;
    await product.save();

    const io = req.app.get('io');
    if (io) io.emit('stockIntakeCreated', intake);

    res.redirect('/stock-intake');
  } catch (err) {
    console.error('Error creating stock intake', err);
    res.status(500).send('Server error');
  }
};

// API: list intakes
exports.apiIndex = async (req, res) => {
  const intakes = await StockIntake.find().populate('product').sort({ createdAt: -1 });
  res.json(intakes);
};

// API: get intake by id
exports.apiShow = async (req, res) => {
  const intake = await StockIntake.findById(req.params.id).populate('product');
  if (!intake) return res.status(404).send('Not found');
  res.json(intake);
};

// Delete intake
exports.delete = async (req, res) => {
  await StockIntake.findByIdAndDelete(req.params.id);
  res.redirect('/stock-intake');
};
