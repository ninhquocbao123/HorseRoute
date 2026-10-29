const rtf = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thời gian tương đối bằng tiếng Việt: "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", quá 7 ngày thì ngày tháng. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff)) return '';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days <= 7 ? `${days} ngày trước` : rtf.format(new Date(iso));
}
