import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/helpers.js';
import {
  payrollRulesChanged,
  applyPayrollRulesEverywhere,
} from '../services/applyPayrollRules.js';

/** Samoa P4 PAYE brackets: $14,976 free then 20% (≡ $576 free / fortnight @ 20%) */
const SAMOA_P4_TAX_BRACKETS = [
  { min: 0, max: 14976, rate: 0 },
  { min: 14976, max: null, rate: 0.2 },
];

const isLegacyTaxBrackets = (brackets) => {
  if (!Array.isArray(brackets) || brackets.length < 2) return true;
  const hasMidBand = brackets.some(
    (b) => Number(b.rate) === 0.1 || (Number(b.min) === 15000 && Number(b.max) === 25000)
  );
  const hasNewFree = brackets.some((b) => Number(b.max) === 14976 && Number(b.rate) === 0);
  return hasMidBand || !hasNewFree;
};

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});

  // One-time migrate away from old progressive 0/10/20% brackets so stored payslips refresh
  if (isLegacyTaxBrackets(settings.taxBrackets)) {
    const before = settings.toObject();
    settings.taxBrackets = SAMOA_P4_TAX_BRACKETS;
    await settings.save();

    // Drop saved P4 tax cell overrides so periods recompute from the authority formula
    try {
      const StatutoryOverride = (await import('../models/StatutoryOverride.js')).default;
      await StatutoryOverride.deleteMany({
        sheet: 'paye',
        field: { $in: ['taxPeriod1', 'taxPeriod2', 'taxPeriod3', 'totalTax'] },
      });
    } catch {
      /* ignore if model unavailable */
    }

    if (payrollRulesChanged(before, settings.toObject())) {
      await applyPayrollRulesEverywhere(settings);
    }
  }

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
