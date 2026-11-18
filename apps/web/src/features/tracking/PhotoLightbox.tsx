import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ClockCircleOutlined, CloseOutlined, EnvironmentOutlined, LeftOutlined, PictureOutlined, RightOutlined } from '@ant-design/icons';
import { trackingApi } from './tracking.api';
import './photo-lightbox.css';

export type LightboxPhoto = { id: string; name: string; caption?: string; takenAt?: string | null; place?: string | null };

const MAX = 4;
const clockText = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
};

/** Ảnh đính kèm cần token: tải bằng axios rồi hiện qua object URL (giống AttachmentImage). */
function useAttachmentUrl(id: string) {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    let objectUrl: string | null = null, cancelled = false;
    setState({ url: null, failed: false });
    trackingApi.attachmentBlob(id).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, failed: false });
    }).catch(() => !cancelled && setState({ url: null, failed: true }));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return state;
}

/**
 * Trình xem ảnh toàn màn hình (mục 3, bản web): lăn chuột hoặc chụm hai ngón để phóng, nhấp đúp phóng 2,5x / trở về,
 * kéo để xem khi đang phóng; ←/→, nút hai bên hoặc vuốt ngang để chuyển ảnh; Esc, nút X, vuốt xuống hoặc bấm nền để đóng.
 * Có "2/5", thời gian chụp, mốc/địa điểm; đang tải có vòng quay, ảnh lỗi hiện ô thay thế.
 */
export default function PhotoLightbox({ photos, index, onClose }: { photos: LightboxPhoto[]; index: number | null; onClose: () => void }) {
  const [current, setCurrent] = useState(index ?? 0);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dist: 0, scale: 1, startX: 0, startY: 0, viewX: 0, viewY: 0, moved: false });
  const closeButton = useRef<HTMLButtonElement>(null);
  const open = index !== null;
  useEffect(() => { if (index !== null) { setCurrent(index); setView({ scale: 1, x: 0, y: 0 }); } }, [index]);
  const go = (step: number) => { setCurrent(i => Math.min(photos.length - 1, Math.max(0, i + step))); setView({ scale: 1, x: 0, y: 0 }); };
  const zoomTo = (next: (current: number) => number) =>
    setView(v => { const s = Math.min(MAX, Math.max(1, next(v.scale))); return s === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale: s }; });
  const zoom = (scale: number) => zoomTo(() => scale);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !photos[current]) return null;
  const photo = photos[current];

  const down = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = { ...gesture.current, startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y, moved: false, scale: view.scale,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 };
  };
  const move = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()], g = gesture.current;
    const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (pts.length === 2 && g.dist) zoom(g.scale * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist);
    else if (view.scale > 1) setView(v => ({ ...v, x: g.viewX + dx, y: g.viewY + dy }));
  };
  const up = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current, dx = e.clientX - g.startX, dy = e.clientY - g.startY;
    if (view.scale > 1 || pointers.current.size) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 100 && Math.abs(dy) > Math.abs(dx)) onClose();
  };

  return createPortal(
    <div className="plb" role="dialog" aria-modal="true" aria-label={`Ảnh ${current + 1}/${photos.length}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <header className="plb-top">
        <span className="plb-count">{current + 1}/{photos.length}</span>
        <button ref={closeButton} type="button" className="plb-btn" aria-label="Đóng trình xem ảnh" onClick={onClose}><CloseOutlined /></button>
      </header>
      <div
        className="plb-stage"
        onWheel={e => zoomTo(s => s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onDoubleClick={() => zoomTo(s => (s > 1 ? 1 : 2.5))}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={e => { if (e.target === e.currentTarget && !gesture.current.moved) onClose(); }}
        style={{ cursor: view.scale > 1 ? 'grab' : 'zoom-in' }}
      >
        <LightboxImage key={photo.id} photo={photo} transform={`translate(${view.x}px, ${view.y}px) scale(${view.scale})`} />
      </div>
      {current > 0 && <button type="button" className="plb-btn plb-prev" aria-label="Ảnh trước" onClick={() => go(-1)}><LeftOutlined /></button>}
      {current < photos.length - 1 && <button type="button" className="plb-btn plb-next" aria-label="Ảnh sau" onClick={() => go(1)}><RightOutlined /></button>}
      {(photo.caption || photo.takenAt || photo.place) && (
        <footer className="plb-info">
          {photo.caption && <strong>{photo.caption}</strong>}
          {photo.takenAt && <span><ClockCircleOutlined /> Chụp lúc {clockText(photo.takenAt)}</span>}
          {photo.place && <span><EnvironmentOutlined /> {photo.place}</span>}
        </footer>
      )}
    </div>,
    document.body,
  );
}

function LightboxImage({ photo, transform }: { photo: LightboxPhoto; transform: string }) {
  const { url, failed } = useAttachmentUrl(photo.id);
  const [broken, setBroken] = useState(false);
  if (failed || broken) return <div className="plb-missing"><PictureOutlined /><span>Không tải được ảnh này</span></div>;
  if (!url) return <div className="plb-spinner" role="status" aria-label="Đang tải ảnh" />;
  return <img className="plb-img" src={url} alt={photo.caption || photo.name} draggable={false} onError={() => setBroken(true)} style={{ transform }} />;
}
