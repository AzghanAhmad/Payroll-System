import Vendor from '../models/Vendor.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';

export const listVendors = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = {};
  if (status === 'active') filter.isActive = true;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { contactPerson: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }
  const vendors = await Vendor.find(filter).sort({ name: 1 });
  res.json({ items: vendors });
});

export const createVendor = asyncHandler(async (req, res) => {
  const { name, contactPerson, phone, email, address, notes } = req.body;
  if (!name?.trim()) {
    throw new AppError('Vendor name is required', 400);
  }
  const vendor = await Vendor.create({
    name: name.trim(),
    contactPerson: contactPerson?.trim() || '',
    phone: phone?.trim() || '',
    email: email?.trim() || '',
    address: address?.trim() || '',
    notes: notes?.trim() || '',
  });
  res.status(201).json(vendor);
});

export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.json(vendor);
});

export const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findByIdAndDelete(req.params.id);
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.json({ message: 'Vendor deleted successfully' });
});
