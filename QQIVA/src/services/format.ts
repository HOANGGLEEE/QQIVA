export function money(value: unknown) {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)} ₫`;
}

export function shortDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function documentTypeLabel(type?: string) {
  if (type === 'INVOICE') return 'Hóa đơn';
  if (type === 'QUICK_QUOTE') return 'Báo giá nhanh';
  if (type === 'QUOTE') return 'Báo giá';
  return type || 'Chứng từ';
}
