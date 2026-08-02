import mongoose from 'mongoose';

const taxSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'PAYE' },
    year: { type: Number, required: true },
    brackets: [
      {
        min: Number,
        max: Number,
        rate: Number,
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Tax', taxSchema);
