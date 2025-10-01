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

// Render edit intake form
exports.pageEdit = async (req, res) => {
  try {
    const intake = await StockIntake.findById(req.params.id).populate('product');
    if (!intake) return res.status(404).send('Stock intake not found');
    
    const products = await Product.find();
    res.render('stock-intake/edit', { intake, products });
  } catch (err) {
    console.error('Error fetching stock intake for edit', err);
    res.status(500).send('Server error');
  }
};

// Update intake
exports.update = async (req, res) => {
  try {
    const { product: productId, totalWeight, receivedBy } = req.body;
    const intakeId = req.params.id;
    
    // Get the current intake
    const currentIntake = await StockIntake.findById(intakeId).populate('product');
    if (!currentIntake) return res.status(404).send('Stock intake not found');
    
    // Get the new product
    const newProduct = await Product.findById(productId);
    if (!newProduct) return res.status(400).send('Product not found');
    
    const parsedTotal = Number(totalWeight);
    if (isNaN(parsedTotal) || parsedTotal <= 0) return res.status(400).send('Invalid total weight');
    
    if (!newProduct.weight || newProduct.weight <= 0) {
      return res.status(400).send('Selected product does not have a valid unit weight configured');
    }
    
    const newCalculatedQty = Math.floor(parsedTotal / newProduct.weight);
    
    // Revert the stock change from the old intake
    if (currentIntake.product) {
      const oldProduct = await Product.findById(currentIntake.product._id);
      if (oldProduct) {
        oldProduct.quantity = Math.max(0, (oldProduct.quantity || 0) - currentIntake.quantity);
        await oldProduct.save();
      }
    }
    
    // Update the intake
    const updatedIntake = await StockIntake.findByIdAndUpdate(intakeId, {
      product: productId,
      quantity: newCalculatedQty,
      totalWeight: parsedTotal,
      singleWeight: newProduct.weight,
      receivedBy: receivedBy || (req.user ? req.user.email : 'system')
    }, { new: true });
    
    // Apply the new stock change
    newProduct.quantity = (newProduct.quantity || 0) + newCalculatedQty;
    await newProduct.save();
    
    const io = req.app.get('io');
    if (io) io.emit('stockIntakeUpdated', updatedIntake);
    
    res.redirect('/stock-intake');
  } catch (err) {
    console.error('Error updating stock intake', err);
    res.status(500).send('Server error');
  }
};

// API: update intake
exports.apiUpdate = async (req, res) => {
  try {
    const { product: productId, totalWeight, receivedBy } = req.body;
    const intakeId = req.params.id;
    
    // Get the current intake
    const currentIntake = await StockIntake.findById(intakeId).populate('product');
    if (!currentIntake) return res.status(404).json({ error: 'Stock intake not found' });
    
    // Get the new product
    const newProduct = await Product.findById(productId);
    if (!newProduct) return res.status(400).json({ error: 'Product not found' });
    
    const parsedTotal = Number(totalWeight);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return res.status(400).json({ error: 'Invalid total weight' });
    }
    
    if (!newProduct.weight || newProduct.weight <= 0) {
      return res.status(400).json({ error: 'Selected product does not have a valid unit weight configured' });
    }
    
    const newCalculatedQty = Math.floor(parsedTotal / newProduct.weight);
    
    // Revert the stock change from the old intake
    if (currentIntake.product) {
      const oldProduct = await Product.findById(currentIntake.product._id);
      if (oldProduct) {
        oldProduct.quantity = Math.max(0, (oldProduct.quantity || 0) - currentIntake.quantity);
        await oldProduct.save();
      }
    }
    
    // Update the intake
    const updatedIntake = await StockIntake.findByIdAndUpdate(intakeId, {
      product: productId,
      quantity: newCalculatedQty,
      totalWeight: parsedTotal,
      singleWeight: newProduct.weight,
      receivedBy: receivedBy || 'system'
    }, { new: true }).populate('product');
    
    // Apply the new stock change
    newProduct.quantity = (newProduct.quantity || 0) + newCalculatedQty;
    await newProduct.save();
    
    const io = req.app.get('io');
    if (io) io.emit('stockIntakeUpdated', updatedIntake);
    
    res.json(updatedIntake);
  } catch (err) {
    console.error('Error updating stock intake', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete intake
exports.delete = async (req, res) => {
  try {
    const intake = await StockIntake.findById(req.params.id).populate('product');
    if (!intake) return res.status(404).send('Stock intake not found');
    
    // Revert the stock change
    if (intake.product) {
      const product = await Product.findById(intake.product._id);
      if (product) {
        product.quantity = Math.max(0, (product.quantity || 0) - intake.quantity);
        await product.save();
      }
    }
    
    await StockIntake.findByIdAndDelete(req.params.id);
    res.redirect('/stock-intake');
  } catch (err) {
    console.error('Error deleting stock intake', err);
    res.status(500).send('Server error');
  }
};
