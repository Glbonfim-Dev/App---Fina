const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);

/** Converte "1.234,56", "1234.56" ou "1234" em número. Retorna NaN se inválido. */
export function parseMoney(input: string): number {
  const s = input.replace(/[^\d,.-]/g, '').trim();
  if (!s) return NaN;
  let normalized: string;
  if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) normalized = s.replace(/\./g, '');
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Número -> texto editável "1234,56" */
export const moneyInput = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '' : v.toFixed(2).replace('.', ',');

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM' do mês atual */
export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonth(d);
}

export function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${pad2(last)}` };
}

/** Dia do mês ajustado para meses mais curtos (dia 31 em fevereiro -> 28/29) */
export function dateInMonth(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${pad2(Math.min(Math.max(day, 1), last))}`;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

export function monthShort(month: string): string {
  return MONTHS_SHORT[Number(month.split('-')[1]) - 1];
}

export function dateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (iso === today) return 'Hoje';
  if (iso === todayISO(d)) return 'Ontem';
  const [, m, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[m - 1]}`;
}

export const isValidDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;
