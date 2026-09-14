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
    // Reflects Samoa P4 practice: $576 free / fortnight @ 20% → ~$14,976 / year free then 20%
    taxBrackets: {
      type: [taxBracketSchema],
      default: [
        { min: 0, max: 14976, rate: 0 },
        { min: 14976, max: null, rate: 0.2 },
      ],
    },
    digitalSignature: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
