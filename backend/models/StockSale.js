import mongoose from 'mongoose';

const stockSaleSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 0.001 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '', trim: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'credit', 'other'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

stockSaleSchema.index({ employee: 1, date: -1 });

export default mongoose.model('StockSale', stockSaleSchema);
