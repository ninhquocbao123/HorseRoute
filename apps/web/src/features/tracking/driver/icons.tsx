// Bộ icon nghiệp vụ dùng chung cho khung tài xế: xe tải (phương tiện), con ngựa, và "cả hai".
// Cùng cỡ chữ 1em / nét như bộ icon outlined của Ant Design nên đặt cạnh nhau không lệch.
import Icon, { TruckOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

const HorseSvg = () => (
  <svg viewBox="3 2 18 21" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true">
    <path d="M8 8.2 9.6 3.5 12.4 6.2C15.8 6 19 8.6 19 13 19 16.5 18.2 19.5 17.6 21.5H11.2C11.4 19.4 11 18.6 10.2 17.8 8.6 18.3 6.4 18.6 5.3 17.8 4.3 17 4.4 15.6 5.2 14.6L8 8.2Z M16.2 8.5C17.2 10.5 17.4 13 16.6 16" />
    <circle cx="12.6" cy="10.4" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

/** Con ngựa (thay trái tim). */
export const HorseIcon = ({ className, style }: { className?: string; style?: CSSProperties }) => <Icon component={HorseSvg} className={className} style={style} />;

/** Xe tải (thay xe hơi): cùng icon với mục "Chuyến vận chuyển" ở sidebar. */
export const VehicleIcon = TruckOutlined;

/** "Cả hai": xe tải + ngựa nhỏ, không dùng dấu "+". */
export const VehicleAndHorseIcon = () => (
  <span className="drv-both-icon" aria-hidden="true"><TruckOutlined /><HorseIcon /></span>
);
