import type { ReactNode } from 'react';
import { Button } from 'antd';
import { unavailableMessage, type MapUnavailableReason } from './map-style';

/** Shown instead of the map: the page around it keeps working, it is never blank. */
export default function MapFallback({ reason, height, children, onRetry }: {
  reason: MapUnavailableReason | 'loading'; height: number | string; children?: ReactNode; onRetry?: () => void;
}) {
  const loading = reason === 'loading';
  return (
    <div className={'trackmap-fallback' + (loading ? ' is-loading' : '')} style={{ minHeight: height }} role={loading ? 'status' : 'note'}>
      <span className="trackmap-fallback-icon" aria-hidden="true">◎</span>
      <strong>{loading ? 'Đang tải bản đồ…' : unavailableMessage[reason]}</strong>
      {!loading && children && <p>{children}</p>}
      {!loading && onRetry && <Button size="small" onClick={onRetry}>Thử tải lại</Button>}
    </div>
  );
}
