const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  code: { type: String }, // Additional product code field
  price: { type: Number, default: 0 }, // Product price
  quantity: { type: Number, default: 0 },
  stockQuantity: { type: Number, default: 0 }, // Alternative stock quantity field
  stockWeight: { type: Number, default: 0 }, // Total stock weight
  location: { type: String },
  weight: { type: Number, default: null }, // Unit weight
  minStockLevel: { type: Number, default: 10 } // Minimum stock threshold for low stock alerts
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
