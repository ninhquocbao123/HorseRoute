import { Alert, Button, Card, Spin, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { type OrderDetail } from '../../../features/orders/types';

type Contact = { name?: string; phone?: string };
type SidebarOrder = OrderDetail & {
  booking_details?: string | { sender?: Contact; recipient?: Contact; pickupTime?: string };
  recipient_name?: string;
  recipient_phone?: string;
};

export default function TripOrderSidebar({ orderId }: { orderId: string }) {
  const { account } = useAuth();
  const query = useQuery({
    queryKey: ['coordinator-order-detail', account?.id, orderId],
    enabled: !!account && !!orderId,
    queryFn: async ({ signal }) => (await api.get<SidebarOrder>(`/orders/${encodeURIComponent(orderId)}`, { signal })).data,
  });
  if (query.isPending) return <Card><Spin /><p>Đang tải thông tin đơn…</p></Card>;
  if (query.isError) return <Alert type="error" message="Không tải được thông tin đơn" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>} />;
  const order = query.data;
  let booking: Exclude<SidebarOrder['booking_details'], string>;
  try { booking = typeof order.booking_details === 'string' ? JSON.parse(order.booking_details) : order.booking_details; } catch { booking = undefined; }
  const contacts = [
    { label: 'Người gửi', name: booking?.sender?.name || order.customer.full_name, phone: booking?.sender?.phone || order.customer.phone },
    { label: 'Người nhận', name: booking?.recipient?.name || order.recipient_name, phone: booking?.recipient?.phone || order.recipient_phone },
  ];
  return <Card className="trip-command-header">
    <div className="command-title-row"><div><Typography.Text className="command-eyebrow">THÔNG TIN ĐƠN VẬN CHUYỂN</Typography.Text><Typography.Title level={2}>{order.order_code}</Typography.Title></div></div>
    <div className="journey-strip">
      {[{ label: 'ĐIỂM ĐÓN', address: order.origin_address }, { label: 'ĐIỂM GIAO', address: order.destination_address }].map((point) => <div className="journey-point" key={point.label}><span className="journey-marker"><EnvironmentOutlined /></span><div><small>{point.label}</small><strong>{point.address || 'Chưa cung cấp'}</strong></div></div>)}
    </div>
    <div className="order-sidebar-contacts">{contacts.map((contact) => <div key={contact.label}><small>{contact.label}</small><strong>{contact.name || 'Chưa cung cấp'}</strong>{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>)}</div>
    <dl className="trip-facts">
      <div><dt>Ngày khởi hành yêu cầu</dt><dd>{order.desired_departure_date ? order.desired_departure_date.slice(0, 10).split('-').reverse().join('/') : 'Chưa cung cấp'}</dd></div>
      <div><dt>Giờ đón</dt><dd>{booking?.pickupTime || 'Chưa cung cấp'}</dd></div>
      <div><dt>Số ngựa</dt><dd>{order.horses.length}</dd></div>
      <div><dt>Giấy tờ đã duyệt</dt><dd>{order.documents.filter((item) => item.status === 'VALID').length}/{order.documents.length}</dd></div>
    </dl>
    <div className="order-sidebar-requirements"><small>Yêu cầu đặc biệt</small><p>{order.special_requirements || 'Không có yêu cầu đặc biệt'}</p></div>
  </Card>;
}
