import { CrewReadiness } from './trips.dto';

// This validates the crew roster; the caller decides whether a complete roster can advance the Order.
export function checkCrewReadiness(rows: { userId: string; role: string; accountRole: string; accountStatus: string; crewType: string | null; workStatus: string | null }[]): CrewReadiness {
  const blockers: CrewReadiness['blockers'] = [];
  const eligible = rows.filter(row => row.accountRole === 'DRIVER_ESCORT' && row.accountStatus === 'ACTIVE' && row.crewType === row.role && row.workStatus === 'AVAILABLE');
  for (const row of rows) {
    if (row.accountRole !== 'DRIVER_ESCORT' || row.accountStatus !== 'ACTIVE') blockers.push({ code: 'INELIGIBLE_CREW', userId: row.userId, message: 'Nhân sự không còn ACTIVE hoặc không còn vai trò DRIVER_ESCORT.' });
    else if (!row.crewType) blockers.push({ code: 'MISSING_CREW_PROFILE', userId: row.userId, message: 'Nhân sự chưa có hồ sơ DRIVER/ESCORT.' });
    else if (row.crewType !== row.role) blockers.push({ code: 'CREW_TYPE_MISMATCH', userId: row.userId, message: 'Vai trò phân công không khớp hồ sơ nhân sự.' });
    else if (row.workStatus !== 'AVAILABLE') blockers.push({ code: 'CREW_UNAVAILABLE', userId: row.userId, message: 'Nhân sự đang trong chuyến khác.' });
  }
  if (!eligible.some(row => row.role === 'DRIVER')) blockers.push({ code: 'MISSING_DRIVER', message: 'Chưa có tài xế hợp lệ.' });
  if (!eligible.some(row => row.role === 'ESCORT')) blockers.push({ code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' });
  return { complete: blockers.length === 0, blockers };
}
