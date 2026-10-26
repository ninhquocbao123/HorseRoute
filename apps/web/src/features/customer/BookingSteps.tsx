import './booking-steps.css';

const steps = ['Chuyến đi', 'Chọn ngựa', 'Dịch vụ & bảo hiểm', 'Xác nhận & gửi'];

export default function BookingSteps({ current, onBack }: { current: number; onBack: (step: number) => void }) {
  return <nav className="booking-progress" aria-label="Các bước đặt chuyến">
    <ol>{steps.map((label, index) => <li key={label} className={index === current ? 'is-current' : index < current ? 'is-complete' : ''} aria-current={index === current ? 'step' : undefined}>
      <button type="button" disabled={index >= current} onClick={() => onBack(index)}>
        <span className="booking-progress-number">{index + 1}</span>
        <span>{label}</span>
      </button>
    </li>)}</ol>
  </nav>;
}
