import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Progress, Row, Spin, Tag } from 'antd';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { trackingApi } from '../../../features/tracking/tracking.api';
import TripDetailPanel from '../../../features/tracking/ops/TripDetailPanel';
import '../../../features/tracking/tracking.css';
export default function CoordinatorOperationsPage() {
 const {account}=useAuth(); const [selected,setSelected]=useState<string>();
 const query=useQuery({queryKey:['coordinator',account?.id,'operations'],queryFn:()=>trackingApi.activeTrips(),refetchInterval:60000});
 return <><div className="page-actions"><Button loading={query.isFetching} onClick={()=>void query.refetch()}>Cập nhật trạng thái</Button></div>
 {query.isError&&<Alert type="error" message="Không tải được vận hành. Hãy thử lại."/>}<Spin spinning={query.isPending}><Row gutter={[18,18]}>
 {['running','attention'].map(group=><Col xs={24} lg={12} key={group}><Card className="ops-column" title={group==='running'?'Đang vận chuyển':'Cần chú ý'}>
 {(query.data?.items||[]).filter(i=>group==='attention'?i.openIncidents>0||i.isOverdue:!i.openIncidents&&!i.isOverdue).map(i=><article className={`ops-item ${group}`} key={i.tripId}>
 <strong>{i.orderCode}</strong><p>{i.currentLeg?`${i.currentLeg.fromLocationName} → ${i.currentLeg.toLocationName}`:`${i.completedLegs}/${i.legCount} chặng hoàn thành`}</p>
 <Progress percent={i.legCount?Math.round(i.completedLegs/i.legCount*100):0} strokeColor="#18a45b"/>{i.openIncidents>0&&<Tag color="red">{i.openIncidents} sự cố</Tag>}{i.isOverdue&&<Tag color="gold">Trễ hạn</Tag>}<Button onClick={()=>setSelected(i.tripId)}>Xem tiến độ & xử lý</Button></article>)}
 {!query.isPending&&!query.data?.items.length&&<Empty description="Chưa có chuyến vận hành"/>}</Card></Col>)}
 </Row></Spin>{selected&&<Card style={{marginTop:18}} title="Chi tiết vận hành" extra={<Button onClick={()=>setSelected(undefined)}>Đóng</Button>}><TripDetailPanel key={selected} tripId={selected} role="COORDINATOR" onChanged={()=>void query.refetch()}/></Card>}</>;
}
