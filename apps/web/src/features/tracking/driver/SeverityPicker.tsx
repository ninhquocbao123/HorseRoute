import { CheckOutlined } from '@ant-design/icons';
import type { IncidentSeverity } from '@my-project/shared';
import { SEVERITIES } from './driver-ui';

/** "1. Mức độ sự cố": 3 thẻ Đỏ/Cam/Vàng, chọn đúng 1. */
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
            className={'drv-severity-card is-' + item.value.toLowerCase()} onClick={() => onChange(item.value)}>
            <span className="drv-severity-head">
              <span className="drv-severity-dot" aria-hidden="true" />
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
