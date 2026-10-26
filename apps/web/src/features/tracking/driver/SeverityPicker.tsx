import { CheckOutlined } from '@ant-design/icons';
import type { IncidentSeverity } from '@my-project/shared';
import { SEVERITIES, severityVars } from './driver-ui';

/** "1. Mức độ sự cố": 3 thẻ Nghiêm trọng/Trung bình/Nhẹ, chọn đúng 1. */
export default function SeverityPicker({ value, onChange, disabled, invalid }: {
  value: IncidentSeverity | '';
  onChange: (value: IncidentSeverity) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className={'drv-severity' + (invalid ? ' is-invalid' : '')} role="radiogroup" aria-label="Mức độ sự cố">
      {SEVERITIES.map(item => {
        const checked = value === item.value;
        return (
          <button key={item.value} type="button" role="radio" aria-checked={checked} disabled={disabled}
            className="drv-severity-card" style={severityVars(item.value)} onClick={() => onChange(item.value)}>
            <span className="drv-severity-head">
              <strong>{item.label}</strong>
              <span className="drv-severity-check" aria-hidden="true">{checked && <CheckOutlined />}</span>
            </span>
            <span className="drv-severity-hint">{item.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
