/** Friday-start week periods for a calendar month */

export function getMonthWeek1Start(year, month) {
  const first = new Date(year, month - 1, 1);
  const day = first.getDay();
  const offset = (day - 5 + 7) % 7;
  const start = new Date(year, month - 1, 1 - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekPeriod(year, month, weekNumber) {
  const week1 = getMonthWeek1Start(year, month);
  const start = new Date(week1);
  start.setDate(week1.getDate() + (Number(weekNumber) - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatPeriodLabel(start, end) {
  const fmt = (d) =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
