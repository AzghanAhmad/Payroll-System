import CalendarEvent from '../models/CalendarEvent.js';

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Set of YYYY-MM-DD holiday dates in [start, end] inclusive */
export const holidaySetForRange = async (start, end) => {
  const events = await CalendarEvent.find({
    type: 'holiday',
    date: { $gte: start, $lte: end },
  }).select('date');
  return new Set(events.map((e) => dayKey(e.date)));
};

export const isHolidayDate = async (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  const set = await holidaySetForRange(start, end);
  return set.has(dayKey(date));
};

export { dayKey as calendarDayKey };
