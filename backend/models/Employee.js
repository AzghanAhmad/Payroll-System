import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    photo: { type: String, default: '' },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    dob: { type: Date },
    village: { type: String, default: '' },
    address: { type: String, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    position: { type: String, default: '' },
    hourlyRate: { type: Number, required: true, default: 0 },
    hireDate: { type: Date },
    bank: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    npfNumber: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive', 'terminated'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

employeeSchema.index({ fullName: 'text', employeeId: 'text', email: 'text' });

export default mongoose.model('Employee', employeeSchema);
