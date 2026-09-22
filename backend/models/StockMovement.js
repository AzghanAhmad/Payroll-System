import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment', 'initial'],
      required: true,
    },
    quantity: { type: Number, required: true },
    startBalance: { type: Number, default: 0 },
    endBalance: { type: Number, default: 0 },
    reason: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, date: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);
