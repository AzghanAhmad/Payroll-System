import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Department from '../models/Department.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';

await connectDB();

await Promise.all([
  User.deleteMany({}),
  Settings.deleteMany({}),
  Department.deleteMany({}),
  Employee.deleteMany({}),
  Notification.deleteMany({}),
]);

const settings = await Settings.create({
  companyName: 'Pacific Payroll Ltd',
  companyAddress: 'Apia, Samoa',
  companyPhone: '+685 12345',
  companyEmail: 'hr@pacificpayroll.local',
  currency: 'WST',
  weekStart: 'friday',
  normalHoursCap: 40,
  otMultiplier: 1.5,
  doubleMultiplier: 2,
  doubleTimeRule: 'sunday',
  employerNpfRate: 0.1,
  employeeNpfRate: 0.1,
  employerAccRate: 0.01,
  employeeAccRate: 0.01,
  teaFundAmount: 2,
});

const admin = await User.create({
  name: 'System Admin',
  email: 'admin@payroll.local',
  password: 'admin123',
  role: 'admin',
});

await User.create({
  name: 'HR Manager',
  email: 'hr@payroll.local',
  password: 'hr12345',
  role: 'hr',
});

const depts = await Department.insertMany([
  { name: 'Operations', code: 'OPS' },
  { name: 'Administration', code: 'ADM' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Field Work', code: 'FLD' },
]);

await Employee.insertMany([
  {
    employeeId: 'EMP-0001',
    fullName: 'Sione Tau',
    email: 'sione@example.com',
    phone: '7200001',
    village: 'Vaimoso',
    department: depts[0]._id,
    position: 'Supervisor',
    hourlyRate: 18.5,
    hireDate: new Date('2022-03-01'),
    bank: 'ANZ',
    accountNumber: '100200300',
    npfNumber: 'NPF001',
    status: 'active',
  },
  {
    employeeId: 'EMP-0002',
    fullName: 'Mele Fale',
    email: 'mele@example.com',
    phone: '7200002',
    village: 'Vaitele',
    department: depts[1]._id,
    position: 'Clerk',
    hourlyRate: 14.0,
    hireDate: new Date('2023-01-15'),
    bank: 'BSP',
    accountNumber: '200300400',
    npfNumber: 'NPF002',
    status: 'active',
  },
  {
    employeeId: 'EMP-0003',
    fullName: 'Tui Latu',
    email: 'tui@example.com',
    phone: '7200003',
    village: 'Faleasiu',
    department: depts[3]._id,
    position: 'Labourer',
    hourlyRate: 12.5,
    hireDate: new Date('2024-06-01'),
    bank: 'ANZ',
    accountNumber: '300400500',
    npfNumber: 'NPF003',
    status: 'active',
  },
]);

await Notification.create({
  user: admin._id,
  title: 'Welcome',
  message: 'Payroll system seeded successfully. Login with admin@payroll.local / admin123',
  type: 'success',
});

console.log('Seed complete');
console.log('Admin: admin@payroll.local / admin123');
console.log('HR: hr@payroll.local / hr12345');
console.log('Company:', settings.companyName);

await mongoose.disconnect();
process.exit(0);
