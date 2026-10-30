import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, DatePicker, Modal } from 'antd';
import { CheckCircleFilled, ClockCircleOutlined, EnvironmentFilled } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { formatDateTime } from '../tracking.format';

/**
 * Hộp thoại xác nhận mọi thao tác ghi mốc của tài xế (bắt đầu chuyến, check-in điểm dừng, giao ngựa...): tiêu đề to trên nền teal,
 * tên lộ trình in đậm, nút "Xác nhận" xanh đậm; "Bù giờ" là liên kết nhỏ ở góc dưới bên trái.
 * `tapAt` là giờ bấm nút; chỉ khi bật "Bù giờ" mới dùng giờ tài xế chọn.
 */
export default function CheckInDialog({ open, tapAt, kicker, heading, routeLabel, route, detail, children, confirmLabel = 'Xác nhận', busy, error, onCancel, onConfirm }: {
  open: boolean;
  tapAt: Date | null;
  /** Dòng nhỏ phía trên tiêu đề, ví dụ "Chặng 1/3". */
  kicker?: string;
  heading: string;
  /** Nhãn nhỏ của khối tên lộ trình ("Lộ trình", "Điểm dừng"...). */
  routeLabel: string;
  /** Tên lộ trình / điểm dừng, in đậm to cho tài xế đọc. */
  route: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (when: Date) => void;
}) {
  const [backfill, setBackfill] = useState(false);
  const [customTime, setCustomTime] = useState<Dayjs | null>(null);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBackfill(false);
    setLocalError('');
    setCustomTime(dayjs(tapAt ?? new Date()));
  }, [open, tapAt]);

  function submit() {
    const when = backfill ? customTime?.toDate() ?? null : tapAt;
    if (!when) return setLocalError('Chọn giờ thực tế.');
    if (when.getTime() > Date.now() + 60_000) return setLocalError('Giờ không được ở tương lai.');
    setLocalError('');
    onConfirm(when);
  }

  const shown = backfill ? customTime : tapAt ? dayjs(tapAt) : null;
  const message = localError || error;

  return (
    <Modal
      open={open} centered width={560} title={null} closable={false} footer={null} destroyOnHidden rootClassName="drv-dialog"
      mask={{ closable: !busy }} keyboard={!busy} onCancel={() => !busy && onCancel()}
      styles={{ container: { padding: 0, overflow: 'hidden', borderRadius: 24 } }}
    >
      <header className="drv-dialog-head">
        <span className="drv-dialog-icon" aria-hidden="true"><CheckCircleFilled /></span>
        <div>
          {kicker && <small>{kicker}</small>}
          <h2>{heading}</h2>
        </div>
      </header>

      <div className="drv-dialog-body">
        <section className="drv-dialog-route">
          <span className="drv-dialog-route-label"><EnvironmentFilled /> {routeLabel}</span>
          <strong>{route}</strong>
          {detail && <span className="drv-dialog-route-detail">{detail}</span>}
        </section>

        {children}

        <div className="drv-dialog-time">
          <ClockCircleOutlined aria-hidden="true" />
          <span>Giờ ghi nhận</span>
          <strong>{shown ? formatDateTime(shown.toISOString()) : '—'}</strong>
        </div>

        {backfill && (
          <div className="drv-dialog-backfill">
            <DatePicker
              showTime={{ format: 'HH:mm' }} format="HH:mm DD/MM/YYYY" value={customTime} onChange={setCustomTime} allowClear={false}
              disabledDate={date => date.isAfter(dayjs(), 'minute')} aria-label="Giờ thực tế" style={{ width: '100%' }}
            />
            <small>Chỉ nhập bù trong thời gian cho phép; quá hạn cần Điều phối viên hiệu chỉnh.</small>
          </div>
        )}

        {message && <Alert type="error" showIcon title={message} />}
      </div>

      <footer className="drv-dialog-foot">
        <button type="button" className="drv-dialog-backfill-toggle" aria-pressed={backfill} disabled={busy} onClick={() => setBackfill(on => !on)}>
          <ClockCircleOutlined /> {backfill ? 'Dùng giờ hiện tại' : 'Bù giờ'}
        </button>
        <div className="drv-dialog-actions">
          <Button size="large" className="drv-dialog-cancel" disabled={busy} onClick={onCancel}>Hủy</Button>
          <Button size="large" type="primary" className="drv-dialog-ok" loading={busy} onClick={submit}>{confirmLabel}</Button>
        </div>
      </footer>
    </Modal>
  );
}
