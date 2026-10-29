import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import viVN from 'antd/es/date-picker/locale/vi_VN';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import 'dayjs/locale/vi';

type Props = Pick<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'value' | 'disabled' | 'required' | 'min' | 'max' | 'className' | 'onChange' | 'aria-label'> & {
  type: 'date' | 'datetime-local';
  status?: 'error' | 'warning';
};

/** Display Vietnamese dates while preserving the existing ISO/local API values. */
export function DateInput({ type, value, min, max, onChange, required, ...props }: Props) {
  const timed = type === 'datetime-local';
  return <DatePicker
    {...props}
    locale={viVN}
    style={{ width: '100%' }}
    value={value ? dayjs(String(value)) : null}
    format={timed ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
    placeholder={timed ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
    showTime={timed ? { format: 'HH:mm' } : false}
    minDate={min ? dayjs(String(min)) : undefined}
    maxDate={max ? dayjs(String(max)) : undefined}
    onChange={date => {
      if (date && ((min && date.isBefore(dayjs(String(min)), timed ? 'minute' : 'day')) || (max && date.isAfter(dayjs(String(max)), timed ? 'minute' : 'day')))) return;
      const next = date ? date.format(timed ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD') : '';
      const target = { value: next, name: props.name || '' };
      onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLInputElement>);
    }}
    required={required}
  />;
}


