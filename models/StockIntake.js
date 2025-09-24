const mongoose = require('mongoose');

const stockIntakeSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  totalWeight: { type: Number },
  singleWeight: { type: Number },
  receivedAt: { type: Date, default: Date.now },
  receivedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('StockIntake', stockIntakeSchema);
