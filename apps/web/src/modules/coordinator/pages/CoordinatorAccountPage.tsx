import { Avatar, Card, Col, Descriptions, Row, Tag, Typography } from 'antd';
import { useAuth } from '../../../features/auth/hooks/useAuth';

export default function CoordinatorAccountPage() {
  const { account } = useAuth();
  if (!account) return null;

  return (
    <Row gutter={[18, 18]}>
      <Col xs={24} lg={8}>
        <Card className="coordinator-profile-card" bordered={false}>
          <Avatar size={90}>{account.fullName.slice(0, 1).toUpperCase()}</Avatar>
          <Typography.Title level={2}>{account.fullName}</Typography.Title>
          <Typography.Paragraph>Coordinator · Điều phối viên</Typography.Paragraph>
          <Tag color={account.accountStatus === 'ACTIVE' ? 'green' : 'gold'}>
            {account.accountStatus === 'ACTIVE' ? 'Đang hoạt động' : account.accountStatus}
          </Tag>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card className="coordinator-account-card" bordered={false}>
          <Descriptions column={1} styles={{ label: { width: 170 } }}>
            <Descriptions.Item label="Họ và tên"><strong>{account.fullName}</strong></Descriptions.Item>
            <Descriptions.Item label="Email"><strong>{account.email}</strong></Descriptions.Item>
            <Descriptions.Item label="Số điện thoại"><strong>{account.phone || 'Chưa cập nhật'}</strong></Descriptions.Item>
            <Descriptions.Item label="Địa chỉ"><strong>{account.address || 'Chưa cập nhật'}</strong></Descriptions.Item>
            <Descriptions.Item label="Vai trò"><strong>Điều phối viên</strong></Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );
}
