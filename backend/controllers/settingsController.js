import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/helpers.js';
import {
  payrollRulesChanged,
  applyPayrollRulesEverywhere,
} from '../services/applyPayrollRules.js';

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});

  const before = settings.toObject();

  const stringFields = [
    'companyName', 'companyAddress', 'companyPhone', 'companyEmail',
    'currency', 'weekStart', 'doubleTimeRule', 'digitalSignature',
    'npfEmployerNumber', 'npfZone', 'accEmpNumber1', 'accEmpNumber2',
  ];
  const numberFields = [
    'normalHoursCap', 'otMultiplier', 'doubleMultiplier',
    'employerNpfRate', 'employeeNpfRate', 'employerAccRate',
    'employeeAccRate', 'teaFundAmount',
    'leaveAnnual', 'leaveSick', 'leaveMaternity', 'leavePaternity', 'leaveBereavement',
    'currentPayrollYear', 'currentPayrollMonth',
  ];

  for (const f of stringFields) {
    if (req.body[f] !== undefined) settings[f] = req.body[f];
  }
  for (const f of numberFields) {
    if (req.body[f] !== undefined && req.body[f] !== '') {
      settings[f] = Number(req.body[f]);
    }
  }
  if (req.body.taxBrackets !== undefined) {
    settings.taxBrackets =
      typeof req.body.taxBrackets === 'string'
        ? JSON.parse(req.body.taxBrackets)
        : req.body.taxBrackets;
  }
  if (req.file) settings.logo = `/uploads/logos/${req.file.filename}`;

  await settings.save();

  let applied = null;
  if (payrollRulesChanged(before, settings.toObject())) {
    applied = await applyPayrollRulesEverywhere(settings);
  }

  res.json({ ...settings.toObject(), _applied: applied });
});
