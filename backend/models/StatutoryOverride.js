import mongoose from 'mongoose';

/**
 * Per year/month overrides for statutory filing sheets.
 * Values merge over payroll-derived rows on GET.
 */
const statutoryOverrideSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    sheet: { type: String, enum: ['paye', 'npf', 'acc', 'meta'], required: true },
    /** employee Mongo id or synthetic row key */
    rowKey: { type: String, required: true },
    week: { type: Number, min: 0, max: 5, default: 0 },
    field: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

statutoryOverrideSchema.index(
  { year: 1, month: 1, sheet: 1, rowKey: 1, week: 1, field: 1 },
  { unique: true }
);

export default mongoose.model('StatutoryOverride', statutoryOverrideSchema);
