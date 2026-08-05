import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import Payslip from '../models/Payslip.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import {
  generatePayslipPdf,
  buildPayslipFilename,
  resolvePayslipPdfPath,
} from '../services/payslipPdf.js';
import { sendMail } from '../services/emailService.js';
import { MONTH_NAMES } from '../services/payrollSchedule.js';
import { uploadRoot } from '../middleware/upload.js';

const unlinkPayslipPdf = (pdfPath) => {
  if (!pdfPath) return;
  const file = path.join(uploadRoot, 'exports', path.basename(pdfPath));
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
};

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
  const payslip = await Payslip.findById(req.params.id).populate('employee', 'employeeId fullName');
  if (!payslip) throw new AppError('Payslip not found', 404);

  const file = await resolvePayslipPdfPath(payslip);
  const filename = buildPayslipFilename(payslip);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(file);
});

/** Zip all payslips for a period — one download instead of many sequential files */
export const downloadPayslipPack = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const type = req.query.type || 'weekly';
  if (!year || !month) throw new AppError('year and month required');

  const filter = { year, month, type };
  if (type === 'weekly' && req.query.week) filter.week = Number(req.query.week);

  const payslips = await Payslip.find(filter)
    .populate('employee', 'employeeId fullName')
    .sort({ week: 1, 'employee.fullName': 1 });

  if (!payslips.length) throw new AppError('No payslips for this period', 404);

  const weekPart = type === 'weekly' && req.query.week ? `_Week${req.query.week}` : '_Monthly';
  const zipName = `Payslips_${MONTH_NAMES[month - 1]}_${year}${weekPart}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on('error', (err) => {
    throw err;
  });
  archive.pipe(res);

  for (const p of payslips) {
    if (!p.employee) continue;
    const file = await resolvePayslipPdfPath(p);
    archive.file(file, { name: buildPayslipFilename(p) });
  }

  await archive.finalize();
});

export const emailPayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate('employee', 'email fullName');
  if (!payslip) throw new AppError('Payslip not found', 404);
  if (!payslip.employee?.email) throw new AppError('Employee has no email');

  const file = await resolvePayslipPdfPath(payslip);
  const filename = buildPayslipFilename(payslip);

  await sendMail({
    to: payslip.employee.email,
    subject: `Payslip — ${payslip.periodLabel}`,
    text: `Dear ${payslip.employee.fullName}, please find your payslip attached.`,
    html: `<p>Dear ${payslip.employee.fullName},</p><p>Please find your payslip for <strong>${payslip.periodLabel}</strong> attached.</p>`,
    attachments: [{ filename, path: file }],
  });

  payslip.emailedAt = new Date();
  await payslip.save();
  res.json({ message: 'Payslip emailed', emailedAt: payslip.emailedAt });
});

export const deletePayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate('employee', 'fullName');
  if (!payslip) throw new AppError('Payslip not found', 404);

  unlinkPayslipPdf(payslip.pdfPath);
  await payslip.deleteOne();

  res.json({
    message: `Payslip deleted for ${payslip.employee?.fullName || 'employee'}`,
  });
});

/** Delete all payslips for the selected year / month / week (or monthly period) */
export const deletePayslipsForPeriod = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const type = req.query.type || 'weekly';
  if (!year || !month) throw new AppError('year and month required');

  const filter = { year, month, type };
  if (type === 'weekly' && req.query.week) filter.week = Number(req.query.week);

  const payslips = await Payslip.find(filter);
  for (const p of payslips) {
    unlinkPayslipPdf(p.pdfPath);
  }

  const result = await Payslip.deleteMany(filter);
  res.json({
    message: `Deleted ${result.deletedCount} payslip(s)`,
    deleted: result.deletedCount,
  });
});
