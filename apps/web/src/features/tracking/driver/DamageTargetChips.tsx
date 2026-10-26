import type { DamageTarget } from '@my-project/shared';
import { DAMAGE_TARGETS } from './driver-ui';
import { HorseIcon, VehicleAndHorseIcon, VehicleIcon } from './icons';

const ICON: Record<string, JSX.Element> = { VEHICLE: <VehicleIcon />, HORSE: <HorseIcon />, BOTH: <VehicleAndHorseIcon /> };

/** "3. Hư hại liên quan tới": Xe / Ngựa / Cả hai. */
export default function DamageTargetChips({ value, onChange, disabled, invalid }: {
  value: DamageTarget | '';
  onChange: (value: DamageTarget) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className={'drv-chips' + (invalid ? ' is-invalid' : '')} role="radiogroup" aria-label="Hư hại liên quan tới">
      {DAMAGE_TARGETS.map(item => (
        <button key={item.value} type="button" role="radio" aria-checked={value === item.value} disabled={disabled}
          className="drv-chip" onClick={() => onChange(item.value)}>
          <span aria-hidden="true">{ICON[item.value]}</span>{item.label}
        </button>
      ))}
    </div>
  );
}
