import { CheckOutlined, NotificationOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Spin, Tag, Typography } from 'antd';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { api } from '../../../lib/axios';
import type { Notice } from '../../../features/notifications/NotificationsPanel';
export default function CoordinatorNotificationsPage() {
  const {account}=useAuth(); const qc=useQueryClient(); const key=['coordinator',account?.id,'notifications'];
  const query=useQuery({queryKey:key,queryFn:({signal})=>api.get<Notice[]>('/notifications',{signal}).then(r=>r.data)});
  const read=useMutation({mutationFn:(id:string)=>api.post(`/notifications/${encodeURIComponent(id)}/read`),onSuccess:()=>qc.invalidateQueries({queryKey:key})});
  return <><div className="page-actions"><Button icon={<ReloadOutlined/>} loading={query.isFetching} onClick={()=>void query.refetch()}>Làm mới</Button></div>
    {(query.isError||read.isError)&&<Alert type="error" message="Không cập nhật được thông báo. Vui lòng thử lại."/>}
    <Card className="notification-card" styles={{body:{padding:0}}}><Spin spinning={query.isPending}>
      {!query.isPending&&!query.data?.length?<Empty description="Không có thông báo"/>:query.data?.map(n=><article className={`notice-item ${!n.is_read?'unread':''}`} key={n.id}>
        <span className="notice-icon info"><NotificationOutlined/></span><div className="stack-list-copy"><strong>Thông báo {!n.is_read&&<Tag color="gold">Mới</Tag>}</strong><Typography.Paragraph>{n.content}</Typography.Paragraph></div>
        {!n.is_read&&<Button icon={<CheckOutlined/>} loading={read.isPending&&read.variables===n.id} disabled={read.isPending} onClick={()=>read.mutate(n.id)}>Đã đọc</Button>}
      </article>)}
    </Spin></Card></>;
}
