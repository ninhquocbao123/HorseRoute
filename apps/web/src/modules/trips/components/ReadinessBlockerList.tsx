import type { ReadinessBlocker } from '../types/trip.types';

const groups: Array<{ title: string; codes: string[] }> = [
  { title: 'Nhân sự', codes: ['MISSING_DRIVER', 'MISSING_ESCORT', 'INELIGIBLE_CREW'] },
  { title: 'Kế hoạch và phương tiện', codes: ['PLAN_NOT_APPROVED', 'NO_LEGS', 'INVALID_LEG', 'PLAN_TIME_MISMATCH', 'VEHICLE_INACTIVE', 'VEHICLE_CAPACITY', 'VEHICLE_CONFLICT'] },
  { title: 'Hồ sơ và chứng từ', codes: ['DOCUMENT_NOT_VALID', 'DOCUMENT_EXPIRY_MISSING', 'DOCUMENT_EXPIRED', 'DOSSIER_NOT_APPROVED', 'DOCUMENT_FILE_UNVERIFIED', 'PERMIT_FILE_UNVERIFIED'] },
];

function related(blocker: ReadinessBlocker) {
  const values = [blocker.horseId && `ngựa ${blocker.horseId}`, blocker.documentId && `chứng từ ${blocker.documentId}`, blocker.dossierId && `hồ sơ ${blocker.dossierId}`, blocker.legId && `chặng ${blocker.legId}`, blocker.userId && `nhân sự ${blocker.userId}`].filter(Boolean);
  return values.length ? ` · ${values.join(', ')}` : '';
}

export default function ReadinessBlockerList({ blockers }: { blockers: ReadinessBlocker[] }) {
  if (!blockers.length) return <p className="trip-readiness-ok">Không còn blocker. Backend cho phép xác nhận READY.</p>;
  const known = new Set(groups.flatMap((group) => group.codes));
  const sections = groups.map((group) => ({ ...group, items: blockers.filter((item) => group.codes.includes(item.code)) })).filter((group) => group.items.length);
  const other = blockers.filter((item) => !known.has(item.code));
  if (other.length) sections.push({ title: 'Trạng thái khác', codes: [], items: other });
  return <div className="trip-readiness-blockers">{sections.map((section) => <section className="trip-blocker-group" key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item) => <li className="trip-blocker-item" key={`${item.code}-${item.message}-${item.legId ?? item.documentId ?? item.userId ?? ''}`}><strong>{item.code}</strong><span>{item.message}{related(item)}</span><small>Chưa có thao tác tự động trong Flow 03.</small></li>)}</ul></section>)}</div>;
}
