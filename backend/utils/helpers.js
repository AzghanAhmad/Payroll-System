export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const parseTimeToHours = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
};

export const calcDailyHours = (clockIn, clockOut, breakHours = 0) => {
  const inH = parseTimeToHours(clockIn);
  const outH = parseTimeToHours(clockOut);
  if (inH === null || outH === null) return 0;
  let hours = outH - inH - (Number(breakHours) || 0);
  if (hours < 0) hours += 24;
  return round2(Math.max(0, hours));
};

export const WEEK_DAYS = ['friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
