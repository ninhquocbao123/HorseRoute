import { useMemo, useState } from 'react';
import { Modal } from 'antd';
import { careGallery, type ICareActivity } from '@my-project/shared';
import AttachmentImage from './AttachmentImage';
import { careLabel } from './escort/care-ui';
import { formatDateTime } from './tracking.format';
import './care-gallery.css';

/**
 * Khu "Ảnh trong chuyến": mọi ảnh chăm sóc của chuyến ở một chỗ, không chia theo ngựa.
 * Một lần ghi cho nhiều con chỉ hiện một ảnh, chú thích ghi tên các con (xem careGallery ở shared).
 * Dùng chung cho hộ tống và khách hàng.
 */
export default function CareGallery({ activities, className }: { activities: ICareActivity[]; className?: string }) {
  const items = useMemo(() => careGallery(activities), [activities]);
  const [open, setOpen] = useState<number | null>(null);
  const caption = (index: number) => {
    const item = items[index];
    return `${careLabel(item.activityType)} · ${item.horseNames.length ? item.horseNames.join(', ') : 'Cả đoàn'} · ${formatDateTime(item.performedAt)}`;
  };
  return (
    <section className={'care-gallery ' + (className ?? '')} aria-label="Ảnh trong chuyến">
      <h3 className="care-gallery-title">Ảnh trong chuyến <small>{items.length} ảnh</small></h3>
      {items.length === 0 ? <p className="care-gallery-empty">Chưa có ảnh nào trong chuyến.</p> : (
        <ul className="care-gallery-grid">
          {items.map((item, index) => (
            <li key={item.photo.id}>
              <button type="button" className="care-gallery-item" onClick={() => setOpen(index)} aria-label={`Xem ảnh: ${caption(index)}`}>
                <AttachmentImage id={item.photo.id} name={item.photo.originalName} />
              </button>
              <small>{caption(index)}</small>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open !== null} footer={null} onCancel={() => setOpen(null)} width={760} centered title={open !== null ? caption(open) : ''} destroyOnHidden>
        {open !== null && <div className="care-gallery-full"><AttachmentImage id={items[open].photo.id} name={items[open].photo.originalName} /></div>}
      </Modal>
    </section>
  );
}
