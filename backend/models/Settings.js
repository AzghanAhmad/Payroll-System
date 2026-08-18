import mongoose from 'mongoose';

const taxBracketSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, default: null },
    rate: { type: Number, required: true },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Payroll Company' },
    companyAddress: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    taxIdentificationNumber: { type: String, default: '' },
    logo: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    weekStart: { type: String, default: 'friday' },
    normalHoursCap: { type: Number, default: 40 },
    otMultiplier: { type: Number, default: 1.5 },
    doubleMultiplier: { type: Number, default: 2 },
    doubleTimeRule: {
      type: String,
      enum: ['sunday', 'public_holiday', 'manual', 'none'],
      default: 'sunday',
    },
    employerNpfRate: { type: Number, default: 0.1 },
    employeeNpfRate: { type: Number, default: 0.1 },
    employerAccRate: { type: Number, default: 0.01 },
    employeeAccRate: { type: Number, default: 0.01 },
    teaFundAmount: { type: Number, default: 2 },
    leaveAnnual: { type: Number, default: 10 },
    leaveSick: { type: Number, default: 10 },
    leaveMaternity: { type: Number, default: 20 },
    leavePaternity: { type: Number, default: 3 },
    leaveBereavement: { type: Number, default: 3 },
    currentPayrollYear: { type: Number, default: null },
    currentPayrollMonth: { type: Number, default: null },
    npfEmployerNumber: { type: String, default: '' },
    npfZone: { type: String, default: '' },
    accEmpNumber1: { type: String, default: '' },
    accEmpNumber2: { type: String, default: '' },
    taxBrackets: {
      type: [taxBracketSchema],
      default: [
        { min: 0, max: 15000, rate: 0 },
        { min: 15000, max: 25000, rate: 0.1 },
        { min: 25000, max: null, rate: 0.2 },
      ],
    },
    digitalSignature: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
