import { startOfWeek, startOfMonth, subDays } from 'date-fns';

export const PERIODS = [
  { label: 'Hoy', key: 'today' },
  { label: 'Ayer', key: 'yesterday' },
  { label: 'Semana', key: 'week' },
  { label: 'Mes', key: 'month' },
  { label: 'Mes anterior', key: 'prev-month' },
];

export function getRange(key) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (key === 'today') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0), end: endOfToday };
  if (key === 'yesterday') { const d = subDays(now, 1); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }; }
  // Week: Monday to TODAY (not end of week) — consistent with chat
  if (key === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfToday };
  // Prev month: full previous calendar month
  if (key === 'prev-month') { const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: prev, end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) }; }
  // Month: 1st of month to TODAY (not end of month) — consistent with chat
  return { start: startOfMonth(now), end: endOfToday };
}

export const CURRENT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;