import { Link } from 'react-router-dom';
import { useTripAssignmentsQuery } from '../hooks/use-trip-assignments-query';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import type { TripDetail } from '../types/trip.types';
export default function TripAssignmentsPanel({trip}:{trip:TripDetail}) {
  const {account}=useAuth();const {assignments}=useTripAssignmentsQuery(trip.id);
  if(assignments.isPending)return <p role="status">Đang tải phân công…</p>;
  if(assignments.isError)return <p role="alert">Không tải được phân công.</p>;
  return <div>{assignments.data?.vehicles?.map(vehicle=><section key={vehicle.id}>
    <h3>{vehicle.plateNumber} · {vehicle.horseCount ?? 'Chưa bố trí'} ngựa / {vehicle.capacityStalls} chỗ</h3>
    {(['DRIVER','ESCORT'] as const).map(role=><p key={role}>{role==='DRIVER'?'Tài xế':'Lơ xe'}: {vehicle.crew.filter(p=>p.role===role).map(p=>p.fullName).join(', ') || 'Chưa chọn'}</p>)}
  </section>)}
  {assignments.data?.crewReadiness.blockers.map((b,i)=><p role="alert" key={i}>{b.message}</p>)}
  {account?.role==='COORDINATOR' && <Link to={`/coordinator/trips/${trip.id}`}>Chỉnh sửa phân công theo xe</Link>}
  </div>;
}
