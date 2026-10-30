import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spin, notification } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import type { ICoordinatorIncident } from '@my-project/shared';
import { connectSocket } from '../../../lib/socket';
import { getAccessToken } from '../../../lib/auth-storage';
import { errorMessage, trackingApi } from '../../../features/tracking/tracking.api';
import { useNotifications } from '../../../features/notifications/useNotifications';
import { IncidentFacts, IncidentHeading } from './IncidentDetail';
import { incidentTitle, playChime, severityOf, whenText } from './incident-ui';
import { coordinatorPaths } from '../routes/coordinator.paths';
import './incidents.css';

const POLL_MS = 60_000;
/** Sự cố NEW báo trong khoảng này mà chưa từng bật popup trên máy này thì bật khi mở trang / polling. */
const FRESH_MS = 30 * 60_000;
const SEEN_KEY = 'coord:incident-popups';

type Center = {
  /** Số sự cố đang mở (mới + đang xử lý) của điều phối viên: badge trên menu. */
  openCount: number;
  /** Tăng mỗi khi có sự cố mới / đổi trạng thái: trang Xử lý sự cố tải lại. */
  version: number;
  /** Sự cố mới nhất nhận qua socket (để trang chèn ngay lên đầu timeline). */
  latest: ICoordinatorIncident | null;
  notifications: ReturnType<typeof useNotifications>;
  showDetail: (incident: ICoordinatorIncident | string) => void;
  goHandle: (incidentId: string) => void;
  refresh: () => void;
};

const Context = createContext<Center | null>(null);
export function useIncidentCenter() {
  const value = useContext(Context);
  if (!value) throw new Error('useIncidentCenter phải nằm trong IncidentCenterProvider');
  return value;
}

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
function writeSeen(seen: Set<string>) {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200))); } catch { /* chỉ là tiện ích */ }
}

/**
 * Trung tâm sự cố của khung điều phối: nghe socket `tracking:incident_reported` / `notification:new`, bật popup đỏ góc dưới phải,
 * mở modal chi tiết ở giữa màn hình và giữ dữ liệu cho chuông + badge menu. Mất kết nối thì 60 giây tải lại sự cố đang mở một lần.
 */
export function IncidentCenterProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const notifications = useNotifications(accountId);
  const { addNotice, refresh: refreshNotices } = notifications;
  const [toast, holder] = notification.useNotification({ placement: 'bottomRight', bottom: 24, maxCount: 4, stack: { threshold: 3 } });
  const [openCount, setOpenCount] = useState(0);
  const [version, setVersion] = useState(0);
  const [latest, setLatest] = useState<ICoordinatorIncident | null>(null);
  const [detail, setDetail] = useState<ICoordinatorIncident | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [connected, setConnected] = useState(false);
  const seen = useRef(readSeen());

  const goHandle = useCallback((incidentId: string) => {
    setDetail(null);
    toast.destroy('incident:' + incidentId);
    navigate(`${coordinatorPaths.incidents}?incident=${incidentId}`);
  }, [navigate, toast]);

  const showDetail = useCallback((value: ICoordinatorIncident | string) => {
    setDetailError('');
    if (typeof value !== 'string') { setDetail(value); return; }
    setDetailLoading(true);
    trackingApi.incident(value)
      .then(setDetail)
      .catch(error => setDetailError(errorMessage(error, 'Không tải được sự cố.')))
      .finally(() => setDetailLoading(false));
  }, []);

  const popup = useCallback((incident: ICoordinatorIncident) => {
    if (seen.current.has(incident.id)) return;
    seen.current.add(incident.id);
    writeSeen(seen.current);
    const sev = severityOf(incident);
    if (sev.severity === 'RED' || incident.urgency === 'HIGH') playChime();
    toast.open({
      key: 'incident:' + incident.id,
      duration: 0,
      className: 'coord-incident-toast',
      style: { '--sev': sev.color, '--sev-soft': sev.soft, '--sev-text': sev.text } as React.CSSProperties,
      icon: <ExclamationCircleFilled className="coord-incident-toast-icon" />,
      role: 'alert',
      message: <strong className="coord-incident-toast-title">{incidentTitle(incident)}</strong>,
      description: (
        <span className="coord-incident-toast-body">
          <span className="coord-inc-sev">{sev.label}{incident.urgency === 'HIGH' ? ' · KHẨN' : ''}</span>
          <span className="coord-incident-toast-text">{incident.description}</span>
          <small>{incident.orderCode} · {incident.reportedByName} · {whenText(incident.reportedAt)}</small>
          <span className="coord-incident-toast-hint">Bấm để xem chi tiết</span>
        </span>
      ),
      onClick: () => { toast.destroy('incident:' + incident.id); showDetail(incident); },
    });
  }, [showDetail, toast]);

  /** Tải sự cố đang mở: đếm badge; sự cố NEW vừa báo mà chưa bật popup trên máy này thì bật. */
  const loadOpen = useCallback(async (withPopups: boolean) => {
    try {
      const open = await trackingApi.coordinatorIncidents('open');
      setOpenCount(open.length);
      if (withPopups) {
        open.filter(item => item.status === 'NEW' && Date.now() - Date.parse(item.reportedAt) < FRESH_MS).reverse().forEach(popup);
      }
    } catch {
      // Lần polling / kết nối lại sau sẽ thử lại.
    }
  }, [popup]);

  const refresh = useCallback(() => { setVersion(value => value + 1); void loadOpen(false); }, [loadOpen]);

  useEffect(() => { void loadOpen(true); }, [loadOpen]);

  useEffect(() => {
    const socket = getAccessToken() ? connectSocket() : null;
    if (!socket) return;
    const reported = (payload: { incident: ICoordinatorIncident }) => {
      setLatest(payload.incident);
      setVersion(value => value + 1);
      setOpenCount(value => value + 1);
      popup(payload.incident);
    };
    const notice = (payload: { id: string; content: string; createdAt: string; eventType?: string; relatedType?: string; relatedId?: string }) => addNotice(payload);
    const up = () => {
      setConnected(true);
      void loadOpen(true);
      void refreshNotices();
    };
    const down = () => setConnected(false);
    socket.on('tracking:incident_reported', reported);
    socket.on('notification:new', notice);
    socket.on('connect', up);
    socket.on('disconnect', down);
    setConnected(socket.connected);
    return () => {
      socket.off('tracking:incident_reported', reported);
      socket.off('notification:new', notice);
      socket.off('connect', up);
      socket.off('disconnect', down);
    };
  }, [addNotice, loadOpen, popup, refreshNotices]);

  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') { void loadOpen(true); setVersion(value => value + 1); }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, loadOpen]);

  const value = useMemo<Center>(() => ({ openCount, version, latest, notifications, showDetail, goHandle, refresh }),
    [openCount, version, latest, notifications, showDetail, goHandle, refresh]);

  const modalOpen = detailLoading || !!detail || !!detailError;
  return (
    <Context.Provider value={value}>
      {holder}
      {children}
      <Modal
        open={modalOpen} centered width={680} title={null} footer={null} destroyOnHidden rootClassName="coordinator-scope coord-inc-modal"
        onCancel={() => { setDetail(null); setDetailError(''); setDetailLoading(false); }}
      >
        {detailLoading && <div className="coord-inc-loading"><Spin /></div>}
        {detailError && <p className="coord-inc-error" role="alert">{detailError}</p>}
        {detail && (
          <>
            <IncidentHeading incident={detail} />
            <IncidentFacts incident={detail} />
            <footer className="coord-inc-modal-actions">
              <Button size="large" onClick={() => setDetail(null)}>Đóng</Button>
              {detail.status !== 'CLOSED' && (
                <Button size="large" type="primary" className="coord-inc-handle" onClick={() => goHandle(detail.id)}>Xử lý sự cố</Button>
              )}
              {detail.status === 'CLOSED' && (
                <Button size="large" type="primary" onClick={() => goHandle(detail.id)}>Xem lịch sử xử lý</Button>
              )}
            </footer>
          </>
        )}
      </Modal>
    </Context.Provider>
  );
}
