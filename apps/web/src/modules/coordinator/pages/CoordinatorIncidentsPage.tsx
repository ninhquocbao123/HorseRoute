import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Input, InputNumber, Modal, Segmented, Spin } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import type { ICoordinatorIncident } from '@my-project/shared';
import { useFeedback } from '../../../components/useFeedback';
import { errorMessage, trackingApi } from '../../../features/tracking/tracking.api';
import { IncidentFacts, IncidentHeading, IncidentHistory } from '../incidents/IncidentDetail';
import { useIncidentCenter } from '../incidents/IncidentCenter';
import { REPORTER_ROLE, STATUS_TEXT, WAIT_PRESETS, incidentTitle, minutesText, noteSuggestions, severityOf, waitText, whenText } from '../incidents/incident-ui';

type Scope = 'open' | 'closed';

/**
 * Trang "Xử lý sự cố" của điều phối viên: trái là timeline sự cố (Đang mở / Đã xử lý; sự cố mới đến nổi bật đỏ),
 * phải là chi tiết + lịch sử xử lý + form gửi hướng xử lý (kèm thời gian chờ) hoặc báo đã xử lý xong.
 * `?incident=ID` mở thẳng một sự cố (từ popup, modal, chuông).
 */
export default function CoordinatorIncidentsPage() {
  const { message } = useFeedback();
  const center = useIncidentCenter();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('incident');
  const [scope, setScope] = useState<Scope>('open');
  const [lists, setLists] = useState<Record<Scope, ICoordinatorIncident[]>>({ open: [], closed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [outside, setOutside] = useState<ICoordinatorIncident | null>(null);

  const load = useCallback(async () => {
    try {
      const [open, closed] = await Promise.all([trackingApi.coordinatorIncidents('open'), trackingApi.coordinatorIncidents('closed')]);
      setLists({ open, closed });
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Không tải được danh sách sự cố.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, center.version]);

  // Sự cố mới qua socket: chèn ngay lên đầu timeline trong lúc chờ tải lại.
  useEffect(() => {
    const incoming = center.latest;
    if (!incoming) return;
    setLists(current => (current.open.some(item => item.id === incoming.id) ? current : { ...current, open: [incoming, ...current.open] }));
  }, [center.latest]);

  const all = useMemo(() => [...lists.open, ...lists.closed], [lists]);
  const found = selectedId ? all.find(item => item.id === selectedId) ?? null : null;

  // Mở thẳng một sự cố: chọn đúng tab; không có trong danh sách (vd. cũ hơn 200 bản) thì tải riêng.
  useEffect(() => {
    if (!selectedId || loading) return;
    if (found) { setScope(found.status === 'CLOSED' ? 'closed' : 'open'); setOutside(null); return; }
    trackingApi.incident(selectedId).then(item => { setOutside(item); setScope(item.status === 'CLOSED' ? 'closed' : 'open'); })
      .catch(() => setOutside(null));
  }, [selectedId, found, loading]);

  const selected = found ?? (outside?.id === selectedId ? outside : null);
  const shown = lists[scope];
  const select = (id: string) => setParams(current => { const next = new URLSearchParams(current); next.set('incident', id); return next; });

  async function changed(text: string) {
    void message.success(text);
    await load();
    center.refresh();
  }

  return (
    <div className="coord-inc-page">
      <section className="coord-inc-timeline" aria-label="Danh sách sự cố">
        <header>
          <Segmented<Scope>
            value={scope} onChange={setScope} block
            options={[
              { value: 'open', label: <span>Đang mở <b className="coord-inc-count is-open">{lists.open.length}</b></span> },
              { value: 'closed', label: <span>Đã xử lý <b className="coord-inc-count">{lists.closed.length}</b></span> },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label="Tải lại" />
        </header>
        {error && <Alert type="error" showIcon title={error} />}
        {loading ? <div className="coord-inc-loading"><Spin /></div>
          : !shown.length ? <Empty description={scope === 'open' ? 'Không có sự cố đang mở' : 'Chưa có sự cố đã xử lý'} />
          : (
            <ol>
              {shown.map(item => {
                const sev = severityOf(item);
                const wait = item.status === 'ACKNOWLEDGED' ? waitText(item) : null;
                return (
                  <li key={item.id}>
                    <button
                      type="button" onClick={() => select(item.id)} aria-current={item.id === selectedId ? 'true' : undefined}
                      className={'coord-inc-card is-' + item.status.toLowerCase() + (item.id === selectedId ? ' is-selected' : '')}
                      style={{ '--sev': sev.color, '--sev-soft': sev.soft, '--sev-text': sev.text } as React.CSSProperties}
                    >
                      <time>{whenText(item.reportedAt)}</time>
                      <span className="coord-inc-dot" aria-label={sev.label} />
                      <span className="coord-inc-card-main">
                        <span className="coord-inc-card-top">
                          <strong>{incidentTitle(item)}</strong>
                          {item.status === 'NEW' && <span className="coord-inc-new">MỚI</span>}
                        </span>
                        <span className="coord-inc-card-meta">{item.orderCode} · {item.reportedByName}{item.reporterRole ? ` (${REPORTER_ROLE[item.reporterRole]})` : ''}</span>
                        <span className="coord-inc-card-state">
                          <span className="coord-inc-sev">{sev.label}</span>
                          {item.status === 'ACKNOWLEDGED' && <span className="coord-inc-status is-acknowledged">{STATUS_TEXT.ACKNOWLEDGED}{wait ? ` · ${wait}` : ''}</span>}
                          {item.status === 'CLOSED' && item.closedAt && <span className="coord-inc-status is-closed">Đã xử lý {whenText(item.closedAt)}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
      </section>

      <section className="coord-inc-detail" aria-label="Chi tiết sự cố">
        {!selected ? (
          <div className="coord-inc-placeholder">
            <Empty description={selectedId && !loading ? 'Không tìm thấy sự cố này.' : 'Chọn một sự cố ở danh sách bên trái để xem và xử lý.'} />
          </div>
        ) : (
          <>
            <IncidentHeading incident={selected} />
            <IncidentFacts incident={selected} />
            <section className="coord-inc-block">
              <h3>Lịch sử xử lý</h3>
              <IncidentHistory incident={selected} />
            </section>
            {selected.status !== 'CLOSED' && <HandleForm key={selected.id} incident={selected} onDone={changed} />}
          </>
        )}
      </section>
    </div>
  );
}

/** Gửi hướng xử lý (ghi chú + thời gian chờ) hoặc báo đã xử lý xong; cả hai đều tới tài xế / hộ tống ngay. */
function HandleForm({ incident, onDone }: { incident: ICoordinatorIncident; onDone: (message: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [wait, setWait] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState('');
  const suggestions = noteSuggestions(incident);

  async function send() {
    if (!note.trim()) return setError('Ghi hướng xử lý để gửi cho tài xế / hộ tống.');
    setBusy(true);
    setError('');
    try {
      await trackingApi.updateIncident(incident.id, { status: 'ACKNOWLEDGED', handlingNote: note.trim(), waitMinutes: wait });
      setNote('');
      setWait(null);
      await onDone('Đã gửi hướng xử lý tới tài xế / hộ tống.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (!result.trim()) return setError('Ghi kết quả xử lý trước khi đóng sự cố.');
    setBusy(true);
    setError('');
    try {
      await trackingApi.updateIncident(incident.id, { status: 'CLOSED', handlingNote: result.trim() });
      setResolving(false);
      await onDone('Đã đánh dấu sự cố đã xử lý xong.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="coord-inc-block coord-inc-form">
      <h3>{incident.status === 'NEW' ? 'Gửi hướng xử lý' : 'Gửi thêm cập nhật'}</h3>
      <div className="coord-inc-suggest">
        {suggestions.map(text => <button key={text} type="button" onClick={() => setNote(current => (current ? `${current} ${text}` : text))}>{text}</button>)}
      </div>
      <label>
        <span>Hướng xử lý cho tổ lái</span>
        <Input.TextArea
          rows={4} maxLength={2000} showCount value={note} disabled={busy}
          placeholder="Ví dụ: Đã gọi cứu hộ lốp, đội cứu hộ tới trong khoảng 45 phút. Dừng xe an toàn và kiểm tra ngựa."
          onChange={event => { setNote(event.target.value); setError(''); }}
        />
      </label>
      <div className="coord-inc-wait">
        <span>Thời gian chờ dự kiến (không bắt buộc)</span>
        <div>
          {WAIT_PRESETS.map(minutes => (
            <button key={minutes} type="button" aria-pressed={wait === minutes} disabled={busy} onClick={() => setWait(current => (current === minutes ? null : minutes))}>
              {minutesText(minutes)}
            </button>
          ))}
          <InputNumber min={1} max={1440} precision={0} placeholder="Tự nhập" addonAfter="phút" value={wait} disabled={busy} onChange={value => setWait(value ?? null)} />
        </div>
      </div>
      {error && !resolving && <Alert type="error" showIcon title={error} />}
      <div className="coord-inc-actions">
        <Button size="large" className="coord-inc-resolve" icon={<CheckCircleOutlined />} disabled={busy || incident.status === 'NEW'}
          title={incident.status === 'NEW' ? 'Gửi hướng xử lý trước rồi mới báo đã xử lý xong' : undefined}
          onClick={() => { setResult(''); setError(''); setResolving(true); }}>
          Đã xử lý xong
        </Button>
        <Button size="large" type="primary" className="coord-inc-send" icon={<SendOutlined />} loading={busy && !resolving} onClick={() => void send()}>
          Gửi hướng xử lý
        </Button>
      </div>

      <Modal
        open={resolving} centered title={`Đã xử lý xong: ${incidentTitle(incident)}`} okText="Xác nhận đã xử lý" cancelText="Hủy"
        confirmLoading={busy} onOk={() => void resolve()} onCancel={() => !busy && setResolving(false)} rootClassName="coordinator-scope coord-inc-modal"
      >
        <p className="coord-inc-muted">Sự cố sẽ chuyển sang "Đã xử lý" và tổ lái nhận thông báo kết quả.</p>
        <Input.TextArea rows={4} maxLength={2000} value={result} placeholder="Kết quả: đã thay lốp, xe tiếp tục hành trình lúc 15:40…" onChange={event => { setResult(event.target.value); setError(''); }} />
        {error && resolving && <Alert type="error" showIcon title={error} style={{ marginTop: 12 }} />}
      </Modal>
    </section>
  );
}
