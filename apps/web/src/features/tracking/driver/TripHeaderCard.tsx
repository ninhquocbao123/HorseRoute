import type { ReactNode } from 'react';
import { Tooltip } from 'antd';
import { PhoneOutlined, TeamOutlined } from '@ant-design/icons';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { ORDER_TAG, formatKm, headlineLeg, routeStops, vehicleLabel } from './driver-ui';
import { HorseIcon, VehicleIcon } from './icons';

const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thẻ đầu trang D1/D1b (gọn): mã đơn, trạng thái, tuyến, ngày khởi hành, nút thao tác và 4 ô thông tin một dòng. */
export default function TripHeaderCard({ trip, detail, actions, totalKm = null }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  actions: ReactNode;
  /** Tổng km từ /map; null thì bỏ phần km */
  totalKm?: number | null;
}) {
  const stops = routeStops(trip.legs);
  const route = stops.length ? `${stops[0]} → ${stops[stops.length - 1]}` : 'Chưa có chặng';
  const status = ORDER_TAG[trip.orderStatus];
  // Tài xế thấy người hộ tống; người hộ tống thấy tài xế.
  const partnerRole = trip.crewRole === 'ESCORT' ? 'DRIVER' : 'ESCORT';
  const partners = detail?.crew.filter(member => member.role === partnerRole).map(member => member.name) ?? [];
  const facts = [
    { key: 'vehicle', icon: <VehicleIcon />, label: 'Xe', value: vehicleLabel(headlineLeg(trip.legs, trip.orderStatus), detail?.vehicles) },
    { key: 'crew', icon: <TeamOutlined />, label: partnerRole === 'ESCORT' ? 'Hộ tống' : 'Tài xế', value: partners.join(', ') },
    { key: 'horses', icon: <HorseIcon />, label: 'Ngựa', value: detail?.horses.map(h => h.name).join(', ') },
    { key: 'recipient', icon: <PhoneOutlined />, label: 'Người nhận', value: detail?.recipient?.name },
  ];

  return (
    <section className="drv-card drv-header" aria-label="Chuyến đang chọn">
      <div className="drv-header-top">
        <div className="drv-header-title">
          <div className="drv-header-code">
            <h2>{trip.orderCode}</h2>
            <span className={'drv-badge is-' + trip.orderStatus.toLowerCase()}>{status?.label ?? trip.orderStatus}</span>
          </div>
          <p>{[route, totalKm !== null && `${formatKm(totalKm)} km`, trip.plannedDepartureAt ? day.format(new Date(trip.plannedDepartureAt)) : '—'].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="drv-header-actions">{actions}</div>
      </div>
      <dl className="drv-header-facts">
        {facts.map(fact => {
          const text = detail ? fact.value || '—' : '…';
          return (
            <div key={fact.key}>
              <span className="drv-icon-box" aria-hidden="true">{fact.icon}</span>
              <span>
                <dt>{fact.label}</dt>
                <Tooltip title={detail && fact.value ? text : undefined}><dd>{text}</dd></Tooltip>
              </span>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
