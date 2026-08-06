import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/** Default admin credentials (change anytime in Settings → Account) */
export const DEFAULT_ADMIN_EMAIL = 'alphacc2018@gmail.com';
export const DEFAULT_ADMIN_PASSWORD = 'AlphaCC@Pay2018!xK9';

await mongoose.connect(process.env.MONGODB_URI);
const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
const users = mongoose.connection.collection('users');

const existing =
  (await users.findOne({ role: 'admin' })) ||
  (await users.findOne({ email: 'admin123@gmail.com' })) ||
  (await users.findOne({ email: DEFAULT_ADMIN_EMAIL }));

if (existing) {
  await users.updateOne(
    { _id: existing._id },
    {
      $set: {
        email: DEFAULT_ADMIN_EMAIL,
        password: hash,
        name: 'System Admin',
        role: 'admin',
        isActive: true,
        updatedAt: new Date(),
      },
    }
  );
  // Remove leftover old admin emails
  await users.deleteMany({
    email: { $in: ['admin123@gmail.com', 'admin@payroll.local'] },
    _id: { $ne: existing._id },
  });
  console.log(`Updated admin → ${DEFAULT_ADMIN_EMAIL}`);
} else {
  await users.insertOne({
    name: 'System Admin',
    email: DEFAULT_ADMIN_EMAIL,
    password: hash,
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Created admin → ${DEFAULT_ADMIN_EMAIL}`);
}

console.log(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
await mongoose.disconnect();
