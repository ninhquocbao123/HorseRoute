import { Spin } from 'antd';
import { HORSE_CONDITION_META, type IDriverTripDetail, type IDriverTripSummary } from '@my-project/shared';
import { HistoryDetail } from '../driver/DriverHistory';
import { HorseIcon } from '../driver/icons';
import { formatDateTime } from '../tracking.format';
import CareHistoryList from './CareHistoryList';
import { horseSubtitle } from './care-ui';
import { useCareActivities } from './useCareActivities';

/**
 * Chi tiết CHỈ XEM của một chuyến hộ tống đã giao: thông tin chuyến (dùng lại HistoryDetail), danh sách ngựa, lịch sử hoạt động chăm sóc
 * (chọn ngày + phân trang, không nút Sửa) và các báo cáo sức khỏe đã gửi. Không có form ghi.
 */
export default function EscortHistoryDetail({ trip, detail, onBack }: { trip: IDriverTripSummary; detail: IDriverTripDetail | undefined; onBack: () => void }) {
  const data = useCareActivities(trip.id);
  const sent = data.logs.filter(log => log.reportStatus === 'SENT').sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt));
  const horses = detail?.horses ?? [];
  const now = Date.now();
  return (
    <HistoryDetail
      trip={trip} detail={detail} onBack={onBack}
      extra={(
        <div className="esc-detail-extra">
          <section className="drv-card esc-detail-horses" aria-labelledby="esc-dh-title">
            <h3 id="esc-dh-title" className="drv-card-title">Ngựa của chuyến</h3>
            <ul>
              {horses.map(horse => (
                <li key={horse.id}><span className="esc-horse-photo is-small" aria-hidden="true"><HorseIcon /></span><span><strong>{horse.name}</strong><small>{horseSubtitle(horse, now)}</small></span></li>
              ))}
            </ul>
            {detail && horses.length === 0 && <p className="esc-none">Chuyến không có ngựa.</p>}
          </section>
          {data.loading ? <div className="drv-loading"><Spin /><span>Đang tải nhật ký chăm sóc…</span></div> : (
            <>
              <CareHistoryList
                activities={data.activities} running={false}
                tripStart={trip.legs[0]?.actualDepartureAt ?? trip.legs[0]?.plannedDepartureAt ?? null}
                tripEnd={trip.legs[trip.legs.length - 1]?.actualArrivalAt ?? trip.plannedArrivalAt}
              />
              <section className="drv-card esc-reports" aria-labelledby="esc-rp-title">
                <h3 id="esc-rp-title" className="drv-card-title">Báo cáo sức khỏe đã gửi</h3>
                {sent.length === 0 ? <p className="esc-none">Chuyến này không có báo cáo sức khỏe nào đã gửi.</p> : (
                  <ul>
                    {sent.map(log => (
                      <li key={log.id}>
                        <span className={'esc-badge is-' + log.conditionStatus.toLowerCase()}>{HORSE_CONDITION_META[log.conditionStatus].label}</span>
                        <span className="esc-report-main"><strong>{log.horseName}</strong><small>{formatDateTime(log.loggedAt)}</small></span>
                        <span className="esc-report-state">
                          {!log.sendToCustomer ? 'Chỉ nội bộ' : log.customerViewedAt ? `Khách đã xem ${formatDateTime(log.customerViewedAt)}` : 'Đã gửi, khách chưa xem'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    />
  );
}
