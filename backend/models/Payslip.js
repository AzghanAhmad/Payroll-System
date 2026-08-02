import mongoose from 'mongoose';

const payslipSchema = new mongoose.Schema(
  {
    payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: { type: String, enum: ['weekly', 'monthly'], required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, default: null },
    periodLabel: { type: String, default: '' },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    payDay: { type: Date },
    position: { type: String, default: '' },
    departmentName: { type: String, default: '' },
    hourlyRate: { type: Number, default: 0 },
    normalHours: { type: Number, default: 0 },
    otHours: { type: Number, default: 0 }, // T 1/2
    doubleHours: { type: Number, default: 0 }, // T2
    normalPay: { type: Number, default: 0 },
    otPay: { type: Number, default: 0 },
    doublePay: { type: Number, default: 0 },
    otRate: { type: Number, default: 0 },
    doubleRate: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    employeeNpf: { type: Number, default: 0 },
    employerNpf: { type: Number, default: 0 },
    employeeAcc: { type: Number, default: 0 },
    employerAcc: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    teaFund: { type: Number, default: 0 },
    iouDeduction: { type: Number, default: 0 },
    iouAmount: { type: Number, default: 0 },
    iouPaid: { type: Number, default: 0 },
    loanBalance: { type: Number, default: 0 },
    iouPaymentsCount: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    employerCost: { type: Number, default: 0 },
    bank: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    npfNumber: { type: String, default: '' },
    comments: { type: String, default: '' },
    pdfPath: { type: String, default: '' },
    emailedAt: { type: Date },
  },
  { timestamps: true }
);

payslipSchema.index({ employee: 1, type: 1, year: 1, month: 1, week: 1 });

export default mongoose.model('Payslip', payslipSchema);
