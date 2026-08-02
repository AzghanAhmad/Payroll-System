import mongoose from 'mongoose';

const teaFundSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, default: null },
    payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
  },
  { timestamps: true }
);

export default mongoose.model('TeaFund', teaFundSchema);
