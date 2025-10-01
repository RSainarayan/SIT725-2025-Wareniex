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
    // Support both API (productId) and form (product) field names
    const productId = req.body.product || req.body.productId;
    const weight = req.body.totalWeight || req.body.weight;
    const { quantity, receivedBy, notes } = req.body;
    
    // Check if this is an API request - chai sets application/json when using .send() with objects
    const isAPIRequest = req.get('Content-Type')?.includes('application/json') || 
                        req.get('Accept')?.includes('application/json') ||
                        req.url.includes('/data/');
    
    const product = await Product.findById(productId);
    if (!product) {
      const errorMsg = 'Product not found';
      if (isAPIRequest) {
        return res.status(404).json({ error: errorMsg });
      }
      return res.status(400).send(errorMsg);
    }

    // Handle different input methods
    let calculatedQty;
    let totalWeight;
    let singleWeight;

    if (quantity !== undefined) {
      // Quantity-based input (for API compatibility - tests expect this)
      const parsedQty = Number(quantity);
      if (isNaN(parsedQty) || parsedQty < 0) {
        const errorMsg = 'Invalid quantity';
        if (isAPIRequest) {
          return res.status(400).json({ error: errorMsg });
        }
        return res.status(400).send(errorMsg);
      }

      calculatedQty = parsedQty;
      totalWeight = weight !== undefined ? Number(weight) : (product.weight ? parsedQty * product.weight : parsedQty);
      singleWeight = product.weight || 1;
    } else if (weight !== undefined) {
      // Weight-based calculation (original implementation)
      const parsedTotal = Number(weight);
      if (isNaN(parsedTotal) || parsedTotal < 0) {
        const errorMsg = 'Invalid total weight';
        if (isAPIRequest) {
          return res.status(400).json({ error: errorMsg });
        }
        return res.status(400).send(errorMsg);
      }

      if (!product.weight || product.weight <= 0) {
        const errorMsg = 'Selected product does not have a valid unit weight configured';
        if (isAPIRequest) {
          return res.status(400).json({ error: errorMsg });
        }
        return res.status(400).send(errorMsg);
      }

      calculatedQty = parsedTotal > 0 ? Math.floor(parsedTotal / product.weight) : 0;
      totalWeight = parsedTotal;
      singleWeight = product.weight;
    } else {
      const errorMsg = 'Either quantity or weight must be provided';
      if (isAPIRequest) {
        return res.status(400).json({ error: errorMsg });
      }
      return res.status(400).send(errorMsg);
    }

    const intake = new StockIntake({
      product: productId,
      quantity: calculatedQty,
      totalWeight: totalWeight,
      singleWeight: singleWeight,
      receivedBy: receivedBy || (req.user ? req.user.email : 'system'),
      notes: notes
    });
    await intake.save();

    // Update product stock
    product.quantity = (product.quantity || 0) + calculatedQty;
    if (product.stockQuantity !== undefined) {
      product.stockQuantity = (product.stockQuantity || 0) + calculatedQty;
    }
    if (product.stockWeight !== undefined && totalWeight) {
      product.stockWeight = (product.stockWeight || 0) + totalWeight;
    }
    await product.save();

    const io = req.app.get('io');
    if (io) io.emit('stockIntakeCreated', intake);

    // Return appropriate response based on request type
    if (isAPIRequest) {
      const populatedIntake = await StockIntake.findById(intake._id).populate('product');
      const responseIntake = {
        _id: populatedIntake._id,
        productId: populatedIntake.product._id,
        quantity: populatedIntake.quantity,
        weight: populatedIntake.totalWeight,
        totalWeight: populatedIntake.totalWeight,
        singleWeight: populatedIntake.singleWeight,
        receivedBy: populatedIntake.receivedBy,
        notes: populatedIntake.notes || undefined, // Ensure notes field is always present
        receivedAt: populatedIntake.receivedAt,
        createdAt: populatedIntake.createdAt,
        product: populatedIntake.product
      };
      return res.status(201).json(responseIntake);
    }
    
    res.redirect('/stock-intake');
  } catch (err) {
    console.error('Error creating stock intake', err);
    
    // Check if this is an API request
    const isAPIRequest = req.get('Content-Type')?.includes('application/json') || 
                        req.get('Accept')?.includes('application/json') ||
                        req.url.includes('/data/');
    
    // Handle MongoDB cast errors (invalid ObjectId)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      if (isAPIRequest) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }
      return res.status(400).send('Invalid product ID format');
    }
    
    if (isAPIRequest) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.status(500).send('Server error');
  }
};

// API: list intakes
exports.apiIndex = async (req, res) => {
  try {
    const intakes = await StockIntake.find().populate('product').sort({ createdAt: -1 });
    const formattedIntakes = intakes.map(intake => ({
      _id: intake._id,
      productId: intake.product ? intake.product._id : intake.product,
      quantity: intake.quantity,
      weight: intake.totalWeight,
      totalWeight: intake.totalWeight,
      singleWeight: intake.singleWeight,
      receivedBy: intake.receivedBy,
      notes: intake.notes,
      receivedAt: intake.receivedAt,
      createdAt: intake.createdAt,
      product: intake.product
    }));
    res.json(formattedIntakes);
  } catch (err) {
    console.error('Error fetching stock intakes', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// API: get intake by id
exports.apiShow = async (req, res) => {
  const intake = await StockIntake.findById(req.params.id).populate('product');
  if (!intake) return res.status(404).send('Not found');
  res.json(intake);
};

// API: get intake by id (raw - for internal use)
exports.apiShowRaw = async (req, res, returnData = false) => {
  try {
    const intake = await StockIntake.findById(req.params.id).populate('product');
    if (!intake) {
      if (returnData) return null;
      return res.status(404).send('Not found');
    }
    if (returnData) return intake;
    res.json(intake);
  } catch (err) {
    if (returnData) return null;
    res.status(500).send('Server error');
  }
};

// API: list intakes (raw - for internal use)
exports.apiIndexRaw = async (req, res, returnData = false) => {
  try {
    const intakes = await StockIntake.find().populate('product').sort({ createdAt: -1 });
    if (returnData) return intakes;
    res.json(intakes);
  } catch (err) {
    if (returnData) return [];
    res.status(500).send('Server error');
  }
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
    // Support both API (productId, weight) and form (product, totalWeight) field names
    const productId = req.body.product || req.body.productId;
    const weight = req.body.totalWeight || req.body.weight;
    const { quantity, receivedBy, notes } = req.body;
    const intakeId = req.params.id;
    
    // Get the current intake
    const currentIntake = await StockIntake.findById(intakeId).populate('product');
    if (!currentIntake) return res.status(404).json({ error: 'Stock intake not found' });
    
    // Get the new product
    const newProduct = await Product.findById(productId);
    if (!newProduct) return res.status(400).json({ error: 'Product not found' });
    
    // Handle different input methods - prioritize quantity over weight like in create
    let newCalculatedQty;
    let totalWeight;
    let singleWeight;

    if (quantity !== undefined) {
      // Quantity-based input (for API compatibility)
      const parsedQty = Number(quantity);
      if (isNaN(parsedQty) || parsedQty < 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }

      newCalculatedQty = parsedQty;
      totalWeight = weight !== undefined ? Number(weight) : (newProduct.weight ? parsedQty * newProduct.weight : parsedQty);
      singleWeight = newProduct.weight || 1;
    } else if (weight !== undefined) {
      // Weight-based calculation
      const parsedTotal = Number(weight);
      if (isNaN(parsedTotal) || parsedTotal < 0) {
        return res.status(400).json({ error: 'Invalid total weight' });
      }

      if (!newProduct.weight || newProduct.weight <= 0) {
        return res.status(400).json({ error: 'Selected product does not have a valid unit weight configured' });
      }

      newCalculatedQty = parsedTotal > 0 ? Math.floor(parsedTotal / newProduct.weight) : 0;
      totalWeight = parsedTotal;
      singleWeight = newProduct.weight;
    } else {
      return res.status(400).json({ error: 'Either quantity or weight must be provided' });
    }
    
    // Revert the stock change from the old intake
    if (currentIntake.product) {
      const oldProduct = await Product.findById(currentIntake.product._id);
      if (oldProduct) {
        oldProduct.quantity = Math.max(0, (oldProduct.quantity || 0) - currentIntake.quantity);
        if (oldProduct.stockQuantity !== undefined) {
          oldProduct.stockQuantity = Math.max(0, (oldProduct.stockQuantity || 0) - currentIntake.quantity);
        }
        if (oldProduct.stockWeight !== undefined && currentIntake.totalWeight) {
          oldProduct.stockWeight = Math.max(0, (oldProduct.stockWeight || 0) - currentIntake.totalWeight);
        }
        await oldProduct.save();
      }
    }
    
    // Update the intake
    const updatedIntake = await StockIntake.findByIdAndUpdate(intakeId, {
      product: productId,
      quantity: newCalculatedQty,
      totalWeight: totalWeight,
      singleWeight: singleWeight,
      receivedBy: receivedBy || 'system',
      notes: notes
    }, { new: true }).populate('product');
    
    // Apply the new stock change
    newProduct.quantity = (newProduct.quantity || 0) + newCalculatedQty;
    if (newProduct.stockQuantity !== undefined) {
      newProduct.stockQuantity = (newProduct.stockQuantity || 0) + newCalculatedQty;
    }
    if (newProduct.stockWeight !== undefined && totalWeight) {
      newProduct.stockWeight = (newProduct.stockWeight || 0) + totalWeight;
    }
    await newProduct.save();
    
    const io = req.app.get('io');
    if (io) io.emit('stockIntakeUpdated', updatedIntake);
    
    // Format response for API consistency
    const responseIntake = {
      _id: updatedIntake._id,
      productId: updatedIntake.product._id,
      quantity: updatedIntake.quantity,
      weight: updatedIntake.totalWeight,
      totalWeight: updatedIntake.totalWeight,
      singleWeight: updatedIntake.singleWeight,
      receivedBy: updatedIntake.receivedBy,
      notes: updatedIntake.notes || undefined,
      receivedAt: updatedIntake.receivedAt,
      createdAt: updatedIntake.createdAt,
      product: updatedIntake.product
    };
    
    res.json(responseIntake);
  } catch (err) {
    console.error('Error updating stock intake', err);
    
    // Handle MongoDB cast errors (invalid ObjectId)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }
    
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
