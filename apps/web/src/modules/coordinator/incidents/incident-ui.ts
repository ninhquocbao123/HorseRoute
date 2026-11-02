import { INCIDENT_SEVERITY_META, IncidentSeverity, type IIncident } from '@my-project/shared';
import { incidentKindLabel } from '../../../features/tracking/driver/driver-ui';

/** Mức độ để tô màu: sự cố cũ chưa có `severity` thì suy từ mức khẩn (HIGH → đỏ, còn lại cam). */
export function severityOf(incident: Pick<IIncident, 'severity' | 'urgency'>) {
  const severity = incident.severity ?? (incident.urgency === 'HIGH' ? IncidentSeverity.RED : IncidentSeverity.ORANGE);
  return { severity, ...INCIDENT_SEVERITY_META[severity] };
}

export const incidentTitle = (incident: Pick<IIncident, 'incidentType' | 'subType'>) => incidentKindLabel(incident.incidentType, incident.subType);

export const STATUS_TEXT: Record<string, string> = { NEW: 'Mới đến', ACKNOWLEDGED: 'Đang xử lý', CLOSED: 'Đã xử lý' };
export const REPORTER_ROLE: Record<string, string> = { DRIVER: 'Tài xế', ESCORT: 'Hộ tống' };

const hhmm = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayTime = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false });

/** "14:22" nếu hôm nay, ngược lại "14:22 29/10". */
export function whenText(iso: string, now = Date.now()) {
  const date = new Date(iso);
  return date.toDateString() === new Date(now).toDateString() ? hhmm.format(date) : dayTime.format(date);
}

/** "45 phút" / "1 giờ 30". */
export function minutesText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${String(rest).padStart(2, '0')}` : `${hours} giờ`;
}

/** Phản hồi mới nhất còn hẹn giờ: "chờ ~45 phút · xong lúc 15:40". */
export function waitText(incident: IIncident) {
  const latest = [...(incident.responses ?? [])].reverse().find(item => item.kind === 'RESPONSE');
  if (!latest?.waitMinutes || !latest.expectedAt) return null;
  return `chờ ~${minutesText(latest.waitMinutes)} · xong lúc ${hhmm.format(new Date(latest.expectedAt))}`;
}

export const WAIT_PRESETS = [15, 30, 45, 60, 120];

/** Gợi ý nhanh cho ô hướng xử lý theo loại sự cố. */
export function noteSuggestions(incident: Pick<IIncident, 'incidentType' | 'subType'>): string[] {
  if (incident.incidentType === 'VEHICLE_BREAKDOWN') {
    return incident.subType === 'TIRE_BURST'
      ? ['Đã gọi cứu hộ lốp, đội cứu hộ đang tới.', 'Dừng xe an toàn, bật đèn khẩn cấp và chờ cứu hộ.', 'Kiểm tra ngựa trong lúc chờ thay lốp.']
      : ['Đã gọi cứu hộ xe, đội kỹ thuật đang tới.', 'Đã điều xe dự phòng tới chuyển ngựa.', 'Dừng xe an toàn, bật đèn khẩn cấp và chờ hướng dẫn.'];
  }
  if (incident.incidentType === 'HORSE_MEDICAL') {
    return ['Đã liên hệ bác sĩ thú y, đang trên đường tới.', 'Dừng xe nơi thoáng mát, theo dõi nhịp thở và nhiệt độ ngựa.', 'Hộ tống gửi ảnh và chỉ số ngựa 15 phút một lần.'];
  }
  return ['Đã kiểm tra tuyến, đi theo đường tránh được gửi kèm.', 'Giữ vị trí an toàn, chờ thông đường.', 'Đã báo khách hàng về thời gian giao dự kiến mới.'];
}

/** Tiếng "ting" ngắn cho sự cố khẩn, tự sinh bằng WebAudio (không cần tệp âm thanh); trình duyệt chặn thì bỏ qua. */
export function playChime() {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = new Context();
    [880, 660].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      const start = ctx.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Không phát được âm thanh: popup vẫn hiện.
  }
}

/** Link Google Maps khi sự cố có tọa độ. */
export const mapsLink = (incident: Pick<IIncident, 'latitude' | 'longitude'>) =>
  incident.latitude !== null && incident.longitude !== null ? `https://www.google.com/maps?q=${incident.latitude},${incident.longitude}` : null;
