import { Checkbox } from 'antd';
import { PRE_DEPARTURE_CHECKS } from './driver-ui';

/** Thẻ "Kiểm tra trước khi chạy". Không khóa nút xuất phát; trang cha lưu tick bằng useDraft theo chuyến (quyết định 5.3). */
export default function PreDepartureChecklist({ checked, onChange }: { checked: string[]; onChange: (ids: string[]) => void }) {
  return (
    <section className="drv-card drv-checklist" aria-labelledby="drv-checklist-title">
      <h3 id="drv-checklist-title" className="drv-card-title">Kiểm tra trước khi chạy</h3>
      <Checkbox.Group value={checked} onChange={values => onChange(values as string[])}>
        {PRE_DEPARTURE_CHECKS.map(item => <Checkbox key={item.id} value={item.id}>{item.label}</Checkbox>)}
      </Checkbox.Group>
    </section>
  );
}
