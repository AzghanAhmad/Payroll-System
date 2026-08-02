import Department from '../models/Department.js';
import Employee from '../models/Employee.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';

export const listDepartments = asyncHandler(async (req, res) => {
  const items = await Department.find().sort({ name: 1 });
  res.json(items);
});

export const createDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  res.status(201).json(dept);
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!dept) throw new AppError('Department not found', 404);
  res.json(dept);
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new AppError('Department not found', 404);

  // Unassign staff so the delete is never blocked by references
  await Employee.updateMany({ department: dept._id }, { $unset: { department: 1 } });
  await dept.deleteOne();

  res.json({ message: 'Department deleted' });
});
