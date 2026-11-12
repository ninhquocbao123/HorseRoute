/**
 * B13: thông tin thông quan của chuyến quốc tế (đặt đơn và bổ sung sau ở chi tiết đơn).
 * Không ô nào bắt buộc: số tờ khai thường chỉ có sau khi có giấy kiểm dịch.
 */
export type CustomsValue = { customsCode: string; importPermit: string; border: string };

/** Cửa khẩu phía Việt Nam của các hành lang hệ thống tự lập lộ trình (apps/api/src/features/trips/border-gates.ts). */
const GATES: Record<string, string[]> = {
  CN: ['Hữu Nghị', 'Móng Cái', 'Lào Cai', 'Tà Lùng', 'Thanh Thủy'],
  TH: ['Lao Bảo', 'Cầu Treo', 'Mộc Bài'],
};
export const gatesTo = (country: string) => GATES[country] ?? [];

export default function CustomsFields({ value, onChange, foreignCountry, idPrefix = 'customs' }: {
  value: CustomsValue; onChange: (patch: Partial<CustomsValue>) => void; foreignCountry: string; idPrefix?: string;
}) {
  const gates = gatesTo(foreignCountry);
  // Giá trị cũ không có trong danh sách (đơn trước B13 nhập tay) vẫn giữ để không mất dữ liệu.
  const options = value.border && !gates.includes(value.border) ? [...gates, value.border] : gates;
  return (
    <fieldset className="cj-customs">
      <legend>Thông quan <small>(không bắt buộc, có thể bổ sung sau)</small></legend>
      <p className="cj-muted">Số tờ khai hải quan thường chỉ có sau khi có giấy kiểm dịch. Chưa có thì để trống và bổ sung ở chi tiết đơn trước ngày xe chạy; thiếu số tờ khai thì quản lý chưa chuyển chuyến cho tài xế.</p>
      <div className="cj-grid two">
        <label className="cj-field" htmlFor={`${idPrefix}-border`}><span>Cửa khẩu dự kiến</span>
          <select id={`${idPrefix}-border`} value={value.border} onChange={e => onChange({ border: e.target.value })}>
            <option value="">Để điều phối chọn</option>
            {options.map(gate => <option key={gate} value={gate}>{gate}</option>)}
          </select>
        </label>
        <label className="cj-field" htmlFor={`${idPrefix}-code`}><span>Số tờ khai hải quan</span>
          <input id={`${idPrefix}-code`} value={value.customsCode} maxLength={80} placeholder="Ví dụ: 30512345678" onChange={e => onChange({ customsCode: e.target.value })} />
        </label>
        <label className="cj-field" htmlFor={`${idPrefix}-permit`}><span>Số giấy phép nhập khẩu</span>
          <input id={`${idPrefix}-permit`} value={value.importPermit} maxLength={80} placeholder="Do nước nhận cấp" onChange={e => onChange({ importPermit: e.target.value })} />
        </label>
      </div>
    </fieldset>
  );
}
