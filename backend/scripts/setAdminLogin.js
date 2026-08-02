import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const hash = await bcrypt.hash('admin123', 12);
const users = mongoose.connection.collection('users');

const existing = await users.findOne({ role: 'admin' });
if (existing) {
  await users.updateOne(
    { _id: existing._id },
    { $set: { email: 'admin123@gmail.com', password: hash, name: 'System Admin', isActive: true } }
  );
  // Remove old email duplicate if any
  await users.deleteMany({ email: 'admin@payroll.local', _id: { $ne: existing._id } });
  console.log('Updated admin → admin123@gmail.com / admin123');
} else {
  await users.insertOne({
    name: 'System Admin',
    email: 'admin123@gmail.com',
    password: hash,
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('Created admin → admin123@gmail.com / admin123');
}

await mongoose.disconnect();
