import Department from '../models/Department.js';
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
  const dept = await Department.findByIdAndDelete(req.params.id);
  if (!dept) throw new AppError('Department not found', 404);
  res.json({ message: 'Department deleted' });
});
