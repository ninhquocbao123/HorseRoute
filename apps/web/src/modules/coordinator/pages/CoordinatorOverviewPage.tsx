import { BellOutlined, CarOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Row, Space, Steps, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { coordinatorPaths } from '../routes/coordinator.paths';
import { useTripsQuery } from '../../trips/hooks/use-trips-query';
import { planLabels } from './CoordinatorTripsPage';

export default function CoordinatorOverviewPage() {
  const navigate = useNavigate();
  const trips = useTripsQuery({ page: 1, limit: 3 });
  return (
    <div className="coordinator-overview">
      <Row gutter={[18, 18]}>
        <Col xs={24} md={12}>
          <Card className="quick-card featured">
            <div className="quick-icon"><CarOutlined /></div>
            <Typography.Title level={3}>Chuyến vận chuyển</Typography.Title>
            <Typography.Paragraph>Lập kế hoạch, chọn phương tiện và phân công nhân sự cho chuyến.</Typography.Paragraph>
            <Button type="link" onClick={() => navigate(coordinatorPaths.trips)}>Mở danh sách <RightOutlined /></Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="quick-card">
            <div className="quick-icon"><BellOutlined /></div>
            <Typography.Title level={3}>Thông báo</Typography.Title>
            <Typography.Paragraph>Xem những cập nhật nghiệp vụ gửi đến tài khoản của bạn.</Typography.Paragraph>
            <Button type="link" onClick={() => navigate(coordinatorPaths.notifications)}>Mở thông báo <RightOutlined /></Button>
          </Card>
        </Col>
      </Row>
      <Row gutter={[18, 18]} className="dashboard-lower">
        <Col xs={24} lg={15}>
          <Card title="Chuyến vận chuyển gần đây" className="section-card" loading={trips.isPending}
            extra={<Button type="link" onClick={() => navigate(coordinatorPaths.trips)}>Xem tất cả</Button>}>
            {trips.isError ? <Alert type="error" message="Không tải được danh sách chuyến" action={<Button onClick={() => void trips.refetch()}>Thử lại</Button>} /> :
              trips.data?.items.length ? <Space orientation="vertical" size={11} className="full-width">
                {trips.data.items.map((trip, index) => <div className="priority-item" key={trip.id}>
                  <span className="priority-index">{String(index + 1).padStart(2, '0')}</span>
                  <div><Button type="link" onClick={() => navigate(`${coordinatorPaths.trips}/${trip.id}`)}>{trip.orderCode}</Button><small>Mở để xem kế hoạch và phân công</small></div>
                  <Tag color={trip.planStatus === 'APPROVED' ? 'green' : 'gold'}>{planLabels[trip.planStatus] || trip.planStatus}</Tag>
                </div>)}
              </Space> : <Empty description="Chưa có chuyến vận chuyển" />}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
      <Card title="Quy trình điều phối" className="section-card guide-card">
        <Steps
          orientation="vertical"
          size="small"
          current={-1}
          items={[
            { title: 'Kiểm tra chuyến' },
            { title: 'Lập kế hoạch' },
            { title: 'Phân công nhân sự' },
            { title: 'Gửi duyệt' },
          ]}
        />
      </Card>
        </Col>
      </Row>
    </div>
  );
}
