import mongoose from 'mongoose';

const payrollLineSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    hourlyRate: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    normalHours: { type: Number, default: 0 },
    otHours: { type: Number, default: 0 },
    doubleHours: { type: Number, default: 0 },
    normalPay: { type: Number, default: 0 },
    otPay: { type: Number, default: 0 },
    doublePay: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    employeeNpf: { type: Number, default: 0 },
    employerNpf: { type: Number, default: 0 },
    employeeAcc: { type: Number, default: 0 },
    employerAcc: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    teaFund: { type: Number, default: 0 },
    iouDeduction: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    employerCost: { type: Number, default: 0 },
    bank: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    npfNumber: { type: String, default: '' },
    comments: { type: String, default: '' },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['weekly', 'monthly'], required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, default: null },
    periodLabel: { type: String, default: '' },
    lines: [payrollLineSchema],
    totals: {
      normalHours: { type: Number, default: 0 },
      otHours: { type: Number, default: 0 },
      doubleHours: { type: Number, default: 0 },
      grossPay: { type: Number, default: 0 },
      netPay: { type: Number, default: 0 },
      employerCost: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      iou: { type: Number, default: 0 },
      teaFund: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

payrollSchema.index({ type: 1, year: 1, month: 1, week: 1 }, { unique: true });

export default mongoose.model('Payroll', payrollSchema);
