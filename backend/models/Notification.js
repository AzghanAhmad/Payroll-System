import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    read: { type: Boolean, default: false },
    link: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
