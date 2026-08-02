import mongoose from 'mongoose';

export const LEAVE_TYPES = [
  'annual',
  'sick',
  'maternity',
  'paternity',
  'bereavement',
];

export const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  bereavement: 'Bereavement Leave',
};

const leaveEntrySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    calculatedWorkdays: { type: Number, default: 0 },
    overrideDays: { type: Number, default: null },
    daysCounted: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Approved',
    },
    approvedBy: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

leaveEntrySchema.index({ employee: 1, startDate: 1 });
leaveEntrySchema.index({ status: 1, leaveType: 1 });

export default mongoose.model('LeaveEntry', leaveEntrySchema);
