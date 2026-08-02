import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    method: { type: String, enum: ['payroll', 'manual', 'cash'], default: 'payroll' },
    note: { type: String, default: '' },
    payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
  },
  { _id: true }
);

const weekPaymentSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    week: { type: Number, required: true, min: 1, max: 5 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
    installment: { type: Number, required: true },
    startWeek: { type: Number, default: 1, min: 1, max: 5 },
    amountPaid: { type: Number, default: 0 },
    remainingBalance: { type: Number, required: true },
    status: { type: String, enum: ['active', 'paid', 'cancelled'], default: 'active' },
    history: [paymentSchema],
    /** Tracker-entered weekly repayments (source of truth for IOU Tracker grid) */
    weekPayments: { type: [weekPaymentSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Loan', loanSchema);
