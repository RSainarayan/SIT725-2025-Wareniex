const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  quantity: { type: Number, default: 0 },
  location: { type: String },
  weight: { type: Number, default: null } // Added weight field
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
