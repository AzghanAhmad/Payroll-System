import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'g', 'mm', 'l', 'ml', 'pcs', 'box', 'pack', 'meter'],
      default: 'pcs',
    },
    // Stock balances & thresholds
    startBalance: { type: Number, default: 0 },
    currentQuantity: { type: Number, default: 0 },
    endBalance: { type: Number, default: 0 },
    minQuantity: { type: Number, default: 5 }, // Low stock threshold
    maxQuantity: { type: Number, default: 100 },
    costPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', sku: 'text' });
productSchema.index({ category: 1, vendor: 1 });

export default mongoose.model('Product', productSchema);
