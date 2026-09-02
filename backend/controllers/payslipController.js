import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import Payslip from '../models/Payslip.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
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

export const downloadPayslipExcel = asyncHandler(async (req, res) => {
  const { writePayslipExcel } = await import('../services/payslipExcel.js');
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw new AppError('Payslip not found', 404);
  await writePayslipExcel(res, req.params.id);
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

export const downloadPayslipPackExcel = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const type = req.query.type || 'weekly';
  if (!year || !month) throw new AppError('year and month required');

  const filter = { year, month, type };
  if (type === 'weekly' && req.query.week) filter.week = Number(req.query.week);

  const payslips = await Payslip.find(filter)
    .populate('employee', 'employeeId fullName position')
    .sort({ week: 1 });

  if (!payslips.length) throw new AppError('No payslips for this period', 404);

  const { writePayslipPackExcel } = await import('../services/payslipExcel.js');
  await writePayslipPackExcel(res, payslips);
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

const EDITABLE_NUM_FIELDS = [
  'hourlyRate',
  'normalHours',
  'otHours',
  'doubleHours',
  'normalPay',
  'otPay',
  'doublePay',
  'otRate',
  'doubleRate',
  'grossPay',
  'employeeNpf',
  'employerNpf',
  'employeeAcc',
  'employerAcc',
  'tax',
  'teaFund',
  'iouDeduction',
  'iouAmount',
  'iouPaid',
  'loanBalance',
  'iouPaymentsCount',
  'employerCost',
];

/** Manual edit of payslip amounts (summary / detail). Recalculates net + syncs payroll IOU. */
export const updatePayslip = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw new AppError('Payslip not found', 404);

  const prevIou = Number(payslip.iouDeduction) || 0;

  for (const f of EDITABLE_NUM_FIELDS) {
    if (req.body[f] !== undefined && req.body[f] !== null && req.body[f] !== '') {
      payslip[f] = round2(Number(req.body[f]) || 0);
    }
  }
  if (req.body.comments !== undefined) payslip.comments = String(req.body.comments || '');
  if (req.body.bank !== undefined) payslip.bank = String(req.body.bank || '');
  if (req.body.accountNumber !== undefined) payslip.accountNumber = String(req.body.accountNumber || '');
  if (req.body.npfNumber !== undefined) payslip.npfNumber = String(req.body.npfNumber || '');
  if (req.body.position !== undefined) payslip.position = String(req.body.position || '');

  // Recalculate deductions + net from current field values
  payslip.totalDeductions = round2(
    (Number(payslip.employeeNpf) || 0) +
      (Number(payslip.employeeAcc) || 0) +
      (Number(payslip.tax) || 0) +
      (Number(payslip.teaFund) || 0) +
      (Number(payslip.iouDeduction) || 0)
  );
  payslip.netPay = round2((Number(payslip.grossPay) || 0) - payslip.totalDeductions);

  // Invalidate cached PDF so next download regenerates
  if (payslip.pdfPath) {
    unlinkPayslipPdf(payslip.pdfPath);
    payslip.pdfPath = '';
  }

  await payslip.save();

  // Keep weekly payroll line in sync when IOU deduction changed
  const newIou = Number(payslip.iouDeduction) || 0;
  if (payslip.type === 'weekly' && payslip.week && prevIou !== newIou) {
    const Payroll = (await import('../models/Payroll.js')).default;
    const payroll = await Payroll.findOne({
      type: 'weekly',
      year: payslip.year,
      month: payslip.month,
      week: payslip.week,
    });
    if (payroll) {
      const line = (payroll.lines || []).find(
        (l) => String(l.employee) === String(payslip.employee)
      );
      if (line) {
        line.iouDeduction = newIou;
        line.netPay = round2((Number(line.netPay) || 0) + prevIou - newIou);
        if (payroll.totals) {
          payroll.totals.iou = round2((Number(payroll.totals.iou) || 0) - prevIou + newIou);
          payroll.totals.netPay = round2((Number(payroll.totals.netPay) || 0) + prevIou - newIou);
        }
        payroll.markModified('lines');
        payroll.markModified('totals');
        await payroll.save();
      }
    }
  }

  const populated = await Payslip.findById(payslip._id).populate({
    path: 'employee',
    select: 'employeeId fullName email department bank npfNumber position',
    populate: { path: 'department', select: 'name' },
  });
  res.json(populated);
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
