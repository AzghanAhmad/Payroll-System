import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/payroll_system';
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

export default connectDB;
