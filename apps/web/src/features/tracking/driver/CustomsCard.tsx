import { Alert } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import type { ICustomsInfo, ITripHorse } from '@my-project/shared';

/**
 * B13: giấy tờ tài xế cần khi qua cửa khẩu của chuyến quốc tế: số tờ khai hải quan, giấy phép nhập khẩu, cửa khẩu dự kiến
 * và hộ chiếu từng con ngựa. Chuyến trong nước (customs null) không hiện.
 */
export default function CustomsCard({ customs, horses }: { customs: ICustomsInfo | null | undefined; horses: ITripHorse[] }) {
  if (!customs) return null;
  const row = (label: string, value: string | null, missing: string) => (
    <div className="drv-customs-row"><span>{label}</span><strong className={value ? undefined : 'is-missing'}>{value ?? missing}</strong></div>
  );
  return (
    <section className="drv-card drv-customs" aria-label="Giấy tờ thông quan">
      <h3 className="drv-card-title"><FileProtectOutlined /> Giấy tờ thông quan</h3>
      {row('Số tờ khai hải quan', customs.customsCode, 'Chưa có, hỏi điều phối trước khi tới cửa khẩu')}
      {row('Giấy phép nhập khẩu', customs.importPermit, 'Chưa có')}
      {row('Cửa khẩu dự kiến', customs.border, 'Theo lộ trình')}
      {horses.length > 0 && <div className="drv-customs-row"><span>Hộ chiếu ngựa</span>
        <strong>{horses.map(h => `${h.name} (${h.passportNo})`).join(', ')}</strong></div>}
      {!customs.customsCode && <Alert type="warning" showIcon title="Chuyến chưa có số tờ khai hải quan trên hệ thống." />}
      <small className="drv-customs-note">Mang theo tờ khai đã thông quan, chứng nhận kiểm dịch xuất khẩu, giấy phép nhập khẩu và hộ chiếu từng con ngựa.</small>
    </section>
  );
}
