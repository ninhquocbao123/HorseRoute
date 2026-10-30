import type { TripAssignmentsInput } from '../types/trip.types';
type Fleet = TripAssignmentsInput['vehicles'];
export type SelectedCrew = Fleet[number]['crew'];
export function crewQuota(count: number, people: SelectedCrew): string {
  if (!count) return 'Chưa chọn phương tiện; nhân sự đã chọn được giữ lại.';
  if (new Set(people.map(p=>p.userId)).size !== people.length) return 'Một người chỉ được chọn một lần.';
  for (const role of ['DRIVER','ESCORT'] as const) {
    const n = people.filter(p=>p.role===role).length;
    if(n<count || n>count*2) return `${n<count?'Thiếu':'Thừa'} ${role==='DRIVER'?'tài xế':'lơ xe'}: ${count} xe cần ${count}–${count*2} người, đang chọn ${n}.`;
  }
  return '';
}
export function allocateCrew(fleet: Fleet, people: SelectedCrew, previous: Fleet): Fleet {
  const error = crewQuota(fleet.length,people);
  if(error) throw new Error(error);
  const sorted = [...fleet].sort((a,b)=>a.vehicleId.length-b.vehicleId.length || a.vehicleId.localeCompare(b.vehicleId));
  const result: Fleet = sorted.map(v=>({vehicleId:v.vehicleId,horseCount:v.horseCount,crew:[]}));
  const used = new Set<string>();
  for(const role of ['DRIVER','ESCORT'] as const) {
    for(const vehicle of result) {
      const old = previous.find(v=>v.vehicleId===vehicle.vehicleId)?.crew ?? [];
      vehicle.crew = [...vehicle.crew,...old.filter(p=>p.role===role && people.some(s=>s.userId===p.userId && s.role===role) && !used.has(p.userId)).slice(0,2).map(p=>{used.add(p.userId);return {userId:p.userId,role:p.role};})];
    }
    const remaining = people.filter(p=>p.role===role && !used.has(p.userId)).sort((a,b)=>a.userId.length-b.userId.length || a.userId.localeCompare(b.userId));
    const count = (v: Fleet[number])=>v.crew.filter(p=>p.role===role).length;
    for(const v of result.filter(v=>count(v)===0)) {
      let person = remaining.shift();
      if(!person) {
        const donor = [...result].reverse().find(v=>count(v)===2)!;
        const index = donor.crew.length - 1 - [...donor.crew].reverse().findIndex(p=>p.role===role);
        person = donor.crew.splice(index,1)[0];
      }
      v.crew.push({userId:person.userId,role:person.role});
    }
    for(const p of remaining) result.find(v=>count(v)<2)!.crew.push({userId:p.userId,role:p.role});
  }
  return fleet.map(v=>result.find(r=>r.vehicleId===v.vehicleId)!);
}
