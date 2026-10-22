import type { ReactNode } from 'react';
import { Select } from 'antd';
import { CarOutlined, HeartOutlined, PhoneOutlined, TeamOutlined } from '@ant-design/icons';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { ORDER_TAG, routeStops } from './driver-ui';

const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thẻ đầu trang D1/D1b: mã đơn, trạng thái, tuyến, ngày khởi hành, nút thao tác và 4 ô thông tin. */
export default function TripHeaderCard({ trip, detail, trips, onSelect, actions }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  /** Các chuyến chọn được (đã lọc theo ô tìm kiếm); có từ 2 chuyến thì hiện dropdown. */
  trips: IDriverTripSummary[];
  onSelect: (tripId: string) => void;
  actions: ReactNode;
}) {
  const stops = routeStops(trip.legs);
  const route = stops.length ? `${stops[0]} → ${stops[stops.length - 1]}` : 'Chưa có chặng';
  const status = ORDER_TAG[trip.orderStatus];
  // Tài xế thấy người hộ tống; người hộ tống thấy tài xế.
  const partnerRole = trip.crewRole === 'ESCORT' ? 'DRIVER' : 'ESCORT';
  const partners = detail?.crew.filter(member => member.role === partnerRole).map(member => member.name) ?? [];
  const facts = [
    { key: 'vehicle', icon: <CarOutlined />, label: 'Xe', value: detail?.vehicles.map(v => `${v.code} · ${v.capacityStalls} chuồng`).join(', ') },
    { key: 'crew', icon: <TeamOutlined />, label: partnerRole === 'ESCORT' ? 'Hộ tống' : 'Tài xế', value: partners.join(', ') },
    { key: 'horses', icon: <HeartOutlined />, label: 'Ngựa', value: detail?.horses.map(h => h.name).join(', ') },
    { key: 'recipient', icon: <PhoneOutlined />, label: 'Người nhận', value: detail?.recipient?.name },
  ];

  return (
    <section className="drv-card drv-header" aria-label="Chuyến đang chọn">
      <div className="drv-header-top">
        <div className="drv-header-title">
          <div className="drv-header-code">
            <h2>{trip.orderCode}</h2>
            <span className={'drv-badge is-' + trip.orderStatus.toLowerCase()}>{status?.label ?? trip.orderStatus}</span>
            {trips.length > 1 && (
              <Select
                size="small" className="drv-trip-select" aria-label="Chọn chuyến" value={trip.id} onChange={onSelect} popupMatchSelectWidth={false}
                options={trips.map(t => ({ value: t.id, label: `${t.orderCode} · ${ORDER_TAG[t.orderStatus]?.label ?? t.orderStatus}` }))}
              />
            )}
          </div>
          <p>{route} · {trip.plannedDepartureAt ? day.format(new Date(trip.plannedDepartureAt)) : '—'}</p>
        </div>
        <div className="drv-header-actions">{actions}</div>
      </div>
      <dl className="drv-header-facts">
        {facts.map(fact => (
          <div key={fact.key}>
            <span className="drv-icon-box" aria-hidden="true">{fact.icon}</span>
            <span>
              <dt>{fact.label}</dt>
              <dd>{detail ? fact.value || '—' : '…'}</dd>
            </span>
          </div>
        ))}
      </dl>
    </section>
  );
}
