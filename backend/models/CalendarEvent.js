import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['holiday', 'payroll_processing', 'payday', 'other'],
      default: 'holiday',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

calendarEventSchema.index({ date: 1, type: 1 });

export default mongoose.model('CalendarEvent', calendarEventSchema);
