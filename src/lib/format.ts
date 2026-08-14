export function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function oneMonthAgoIso(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function formatCurrency(value: string | number): string {
  return `$${value}`;
}