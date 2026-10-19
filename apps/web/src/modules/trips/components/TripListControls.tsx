type Props = {
  page: number;
  limit: number;
  total?: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
};

export default function TripListControls({
  page,
  limit,
  total,
  busy,
  onPageChange,
  onLimitChange,
  onRefresh,
}: Props) {
  const pages =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / limit));
  const limits = [...new Set([10, 20, 50, 100, limit])].sort((a, b) => a - b);
  return (
    <div className="trip-list-controls">
      <nav
        className="trip-pagination"
        aria-label="Phân trang chuyến vận chuyển"
      >
        <button
          type="button"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Trước
        </button>
        <span>
          Trang {page}
          {pages !== undefined && ` / ${pages}`}
        </span>
        <button
          type="button"
          disabled={busy || pages === undefined || page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Sau →
        </button>
      </nav>
      <div className="trip-list-options">
        <label htmlFor="trip-page-size">
          Số dòng
          <select
            id="trip-page-size"
            value={limit}
            disabled={busy}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {limits.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={onRefresh}>
          {busy ? "Đang tải…" : "Làm mới"}
        </button>
      </div>
    </div>
  );
}
