import mongoose from 'mongoose';
import { WEEK_DAYS } from '../utils/helpers.js';

const daySchema = new mongoose.Schema(
  {
    clockIn: { type: String, default: '' },
    clockOut: { type: String, default: '' },
    breakHours: { type: Number, default: 0 },
    workingHours: { type: Number, default: 0 },
    dailyCost: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    isDoubleTime: { type: Boolean, default: false },
  },
  { _id: false }
);

const employeeWeekSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    days: {
      friday: { type: daySchema, default: () => ({}) },
      saturday: { type: daySchema, default: () => ({}) },
      sunday: { type: daySchema, default: () => ({}) },
      monday: { type: daySchema, default: () => ({}) },
      tuesday: { type: daySchema, default: () => ({}) },
      wednesday: { type: daySchema, default: () => ({}) },
      thursday: { type: daySchema, default: () => ({}) },
    },
    weeklyHours: { type: Number, default: 0 },
    weeklyCost: { type: Number, default: 0 },
    weeklyNotes: { type: String, default: '' },
  },
  { _id: false }
);

const weekSchema = new mongoose.Schema(
  {
    weekNumber: { type: Number, required: true, min: 1, max: 5 },
    startDate: { type: Date },
    endDate: { type: Date },
    entries: [employeeWeekSchema],
  },
  { _id: false }
);

const timesheetSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    weeks: [weekSchema],
    monthlyHours: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

timesheetSchema.index({ year: 1, month: 1 }, { unique: true });

export { WEEK_DAYS };
export default mongoose.model('Timesheet', timesheetSchema);
