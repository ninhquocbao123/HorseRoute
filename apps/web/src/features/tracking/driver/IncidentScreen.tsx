import { Alert, Button } from 'antd';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import IncidentReportPage from './IncidentReportPage';

/**
 * ?view=incident: màn D2 cho chuyến đang chọn; chuyến không còn báo được sự cố thì chỉ báo lý do.
 * Dùng chung cho tài xế (về `trip`) và hộ tống (về `care`): `home` là view quay về khi hủy / xong.
 */
export default function IncidentScreen({ trip, detail, home, homeLabel, onNavigate, onDone }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  home: string;
  homeLabel: string;
  onNavigate: (view: string, tripId?: string) => void;
  onDone: (message: string) => void;
}) {
  if (trip.orderStatus !== 'READY' && trip.orderStatus !== 'IN_TRANSIT') {
    return (
      <Alert
        type="info" showIcon title="Chỉ báo sự cố khi chuyến sẵn sàng khởi hành hoặc đang vận chuyển."
        action={<Button size="small" onClick={() => onNavigate(home)}>{homeLabel}</Button>}
      />
    );
  }
  return <IncidentReportPage trip={trip} detail={detail} onDone={onDone} onCancel={() => onNavigate(home)} />;
}
