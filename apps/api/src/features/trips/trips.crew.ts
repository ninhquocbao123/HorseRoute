import { CrewReadiness } from './trips.dto';

// Shared with the full readiness service; this checks crew only, never Order READY.
export function checkCrewReadiness(rows: { userId: string; role: string; accountRole: string; accountStatus: string }[]): CrewReadiness {
  const blockers: CrewReadiness['blockers'] = [];
  const eligible = rows.filter(row => row.accountRole === 'DRIVER_ESCORT' && row.accountStatus === 'ACTIVE');
  for (const row of rows) if (!eligible.includes(row)) blockers.push({ code: 'INELIGIBLE_CREW', userId: row.userId, message: 'Nhân sự không còn ACTIVE hoặc không còn vai trò DRIVER_ESCORT.' });
  if (!eligible.some(row => row.role === 'DRIVER')) blockers.push({ code: 'MISSING_DRIVER', message: 'Chưa có tài xế hợp lệ.' });
  if (!eligible.some(row => row.role === 'ESCORT')) blockers.push({ code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' });
  return { complete: blockers.length === 0, blockers };
}
