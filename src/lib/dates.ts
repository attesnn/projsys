/** Date helpers for Gantt timeline. */

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date): Date {
  const result = new Date(d);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  result.setDate(result.getDate() + diff);
  return result;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1, 12, 0, 0, 0);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 12, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

export function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q + 3, 0, 12, 0, 0, 0);
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 12, 0, 0, 0);
}

export function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function daysInMonth(d: Date): number {
  return endOfMonth(d).getDate();
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDayLabel(d: Date): string {
  return String(d.getDate());
}

export function formatDayHeaderLabel(d: Date): string {
  const weekday = d.toLocaleDateString(undefined, { weekday: "narrow" });
  return `${weekday} ${d.getDate()}`;
}

export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short" });
}

export function formatMonthYearLabel(d: Date): string {
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${month} ${d.getFullYear()}`;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}
