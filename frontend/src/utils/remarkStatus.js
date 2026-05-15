export const REMARK_STATUS = {
  new: { code: 'new', title: 'Новая', color: 'warning' },
  review: { code: 'review', title: 'На проверке', color: 'info' },
  done: { code: 'done', title: 'Готово', color: 'success' },
};

export function normalizeRemarkStatus(raw) {
  const s = String(raw || '').trim();
  if (s === 'pending') return 'new';
  if (s === 'processed') return 'done';
  if (s in REMARK_STATUS) return s;
  return 'new';
}

export function remarkStatusMeta(status) {
  return REMARK_STATUS[normalizeRemarkStatus(status)] || REMARK_STATUS.new;
}

export function formatRemarkDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
