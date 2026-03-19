const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, enum: ['inventory', 'seeds'], required: true },
    quantity: { type: Number, required: true, default: 0 },
    retailPrice: { type: Number, required: true },
    wholesalePrice: { type: Number, required: true },
    notes: { type: String },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);

