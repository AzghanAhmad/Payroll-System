import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly', 'department', 'employee', 'attendance', 'iou', 'employer_cost'],
      required: true,
    },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    filePath: { type: String, default: '' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Report', reportSchema);
