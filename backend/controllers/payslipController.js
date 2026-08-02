import path from 'path';
import fs from 'fs';
import Payslip from '../models/Payslip.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { generatePayslipPdf } from '../services/payslipPdf.js';
import { sendMail } from '../services/emailService.js';
import { uploadRoot } from '../middleware/upload.js';

export const listPayslips = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.employee) filter.employee = req.query.employee;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.year) filter.year = Number(req.query.year);
  if (req.query.month) filter.month = Number(req.query.month);
  if (req.query.week) filter.week = Number(req.query.week);
  const items = await Payslip.find(filter)
    .populate({
      path: 'employee',
      select: 'employeeId fullName email department bank npfNumber position',
      populate: { path: 'department', select: 'name' },
    })
    .sort({ year: -1, month: -1, week: -1 });

  let result = items;
  if (req.query.department) {
    result = items.filter(
      (p) => String(p.employee?.department?._id || p.employee?.department) === String(req.query.department)
    );
  }
  res.json(result);
});

export const getPayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate(
    'employee',
    'employeeId fullName email position bank accountNumber npfNumber'
  );
  if (!payslip) throw new AppError('Payslip not found', 404);
  res.json(payslip);
});

export const generatePayslips = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) throw new AppError('ids required');
  const results = [];
  for (const id of ids) {
    const pdfPath = await generatePayslipPdf(id);
    const p = await Payslip.findByIdAndUpdate(id, { pdfPath }, { new: true });
    results.push(p);
  }
  res.json(results);
});

export const downloadPayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw new AppError('Payslip not found', 404);

  let pdfPath = payslip.pdfPath;
  if (!pdfPath) {
    pdfPath = await generatePayslipPdf(payslip._id);
    payslip.pdfPath = pdfPath;
    await payslip.save();
  }

  const absolute = path.join(uploadRoot, '..', pdfPath.replace(/^\//, '').replace(/^uploads/, 'uploads'));
  // pdfPath is /uploads/exports/...
  const file = path.join(uploadRoot, 'exports', path.basename(pdfPath));
  if (!fs.existsSync(file)) {
    const regenerated = await generatePayslipPdf(payslip._id);
    payslip.pdfPath = regenerated;
    await payslip.save();
  }
  const finalFile = path.join(uploadRoot, 'exports', path.basename(payslip.pdfPath));
  res.download(finalFile);
});

export const emailPayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate('employee', 'email fullName');
  if (!payslip) throw new AppError('Payslip not found', 404);
  if (!payslip.employee?.email) throw new AppError('Employee has no email');

  if (!payslip.pdfPath) {
    payslip.pdfPath = await generatePayslipPdf(payslip._id);
    await payslip.save();
  }

  const file = path.join(uploadRoot, 'exports', path.basename(payslip.pdfPath));
  await sendMail({
    to: payslip.employee.email,
    subject: `Payslip — ${payslip.periodLabel}`,
    text: `Dear ${payslip.employee.fullName}, please find your payslip attached.`,
    html: `<p>Dear ${payslip.employee.fullName},</p><p>Please find your payslip for <strong>${payslip.periodLabel}</strong> attached.</p>`,
    attachments: fs.existsSync(file)
      ? [{ filename: path.basename(file), path: file }]
      : undefined,
  });

  payslip.emailedAt = new Date();
  await payslip.save();
  res.json({ message: 'Payslip emailed', emailedAt: payslip.emailedAt });
});
