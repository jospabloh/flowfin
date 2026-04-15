import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

export const PERIODS = [
  { label: 'Hoy', key: 'today' },
  { label: 'Ayer', key: 'yesterday' },
  { label: 'Semana', key: 'week' },
  { label: 'Mes', key: 'month' },
  { label: 'Mes anterior', key: 'prev-month' },
];

export function getRange(key) {
  const now = new Date();
  if (key === 'today') return { start: new Date(new Date().setHours(0,0,0,0)), end: new Date() };
  if (key === 'yesterday') { const d = subDays(new Date(), 1); return { start: new Date(d.setHours(0,0,0,0)), end: new Date(d.setHours(23,59,59,999)) }; }
  if (key === 'week') return { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) };
  if (key === 'prev-month') { const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: prev, end: endOfMonth(prev) }; }
  return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
}

export const CURRENT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;