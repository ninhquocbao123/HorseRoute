// Bộ icon nghiệp vụ dùng chung cho khung tài xế: xe tải (phương tiện), con ngựa, và "cả hai".
// Cùng cỡ chữ 1em / nét như bộ icon outlined của Ant Design nên đặt cạnh nhau không lệch.
import Icon, { TruckOutlined } from '@ant-design/icons';
import { Horse } from '@phosphor-icons/react/dist/icons/Horse';
import { Package } from '@phosphor-icons/react/dist/icons/Package';
import { ForkKnife } from '@phosphor-icons/react/dist/icons/ForkKnife';
import { Drop } from '@phosphor-icons/react/dist/icons/Drop';
import { Armchair } from '@phosphor-icons/react/dist/icons/Armchair';
import type { CSSProperties } from 'react';

// Chỉ import đúng icon cần (đường dẫn con) để bundle không kéo cả bộ Phosphor.
const HorseGlyph = () => <Horse weight="regular" size="1em" aria-hidden="true" />;
const FeedGlyph = () => <ForkKnife weight="regular" size="1em" aria-hidden="true" />;
const DropGlyph = () => <Drop weight="regular" size="1em" aria-hidden="true" />;
const RestGlyph = () => <Armchair weight="regular" size="1em" aria-hidden="true" />;
const ReceiverGlyph = () => <Package weight="regular" size="1em" aria-hidden="true" />;

/** Con ngựa (thay trái tim). */
export const HorseIcon = ({ className, style }: { className?: string; style?: CSSProperties }) => <Icon component={HorseGlyph} className={className} style={style} />;

/** Hoạt động chăm sóc (E1): cho ăn, uống nước, nghỉ chân. */
export const FeedIcon = ({ className }: { className?: string }) => <Icon component={FeedGlyph} className={className} />;
export const DropIcon = ({ className }: { className?: string }) => <Icon component={DropGlyph} className={className} />;
export const RestIcon = ({ className }: { className?: string }) => <Icon component={RestGlyph} className={className} />;

/** Người nhận hàng (thay icon điện thoại). */
export const ReceiverIcon = ({ className }: { className?: string }) => <Icon component={ReceiverGlyph} className={className} />;

/** Xe tải (thay xe hơi): cùng icon với mục "Chuyến vận chuyển" ở sidebar. */
export const VehicleIcon = TruckOutlined;

/** "Cả hai": xe tải + ngựa nhỏ, không dùng dấu "+". */
export const VehicleAndHorseIcon = () => (
  <span className="drv-both-icon" aria-hidden="true"><TruckOutlined /><HorseIcon /></span>
);
