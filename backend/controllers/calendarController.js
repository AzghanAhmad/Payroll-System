import CalendarEvent from '../models/CalendarEvent.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { generatePayrollSchedule } from '../services/payrollSchedule.js';
import { startOfDay } from '../services/leaveService.js';

export const listEvents = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.year) {
    const y = Number(req.query.year);
    const m = req.query.month ? Number(req.query.month) : null;
    if (m) {
      filter.date = {
        $gte: new Date(y, m - 1, 1),
        $lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    } else {
      filter.date = {
        $gte: new Date(y, 0, 1),
        $lte: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }
  }
  const items = await CalendarEvent.find(filter).sort({ date: 1 });
  res.json(items);
});

export const createEvent = asyncHandler(async (req, res) => {
  const { date, title, type = 'holiday', notes = '' } = req.body;
  if (!date || !title) throw new AppError('date and title required');
  const event = await CalendarEvent.create({
    date: startOfDay(date),
    title,
    type,
    notes,
  });
  res.status(201).json(event);
});

export const updateEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id);
  if (!event) throw new AppError('Event not found', 404);
  for (const f of ['date', 'title', 'type', 'notes']) {
    if (req.body[f] !== undefined) {
      event[f] = f === 'date' ? startOfDay(req.body[f]) : req.body[f];
    }
  }
  await event.save();
  res.json(event);
});

export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findByIdAndDelete(req.params.id);
  if (!event) throw new AppError('Event not found', 404);
  res.json({ message: 'Deleted' });
});

/** Combined month view: user events + computed paydays / processing days */
export const getMonthCalendar = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const events = await CalendarEvent.find({
    date: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0, 23, 59, 59, 999),
    },
  }).sort({ date: 1 });

  const schedule = generatePayrollSchedule(year).filter(
    (r) =>
      (r.payday.getFullYear() === year && r.payday.getMonth() + 1 === month) ||
      (r.periodEnd.getFullYear() === year && r.periodEnd.getMonth() + 1 === month)
  );

  const computed = [];
  for (const r of schedule) {
    if (r.payday.getFullYear() === year && r.payday.getMonth() + 1 === month) {
      computed.push({
        date: r.payday,
        title: 'Payday',
        type: 'payday',
        source: 'schedule',
        notes: r.payCycle,
      });
    }
    // Processing day = Thursday (period end) — day before payday
    if (r.periodEnd.getFullYear() === year && r.periodEnd.getMonth() + 1 === month) {
      computed.push({
        date: r.periodEnd,
        title: 'Payroll Processing',
        type: 'payroll_processing',
        source: 'schedule',
        notes: r.payCycle,
      });
    }
  }

  res.json({
    year,
    month,
    events,
    computed,
  });
});
