import { ClockCircleOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';

type Props = {
  title: string;
  description: string;
};

export default function CoordinatorPlaceholderPage({ title, description }: Props) {
  return (
    <Card className="coordinator-placeholder" bordered={false}>
      <span className="coordinator-placeholder__icon" aria-hidden="true"><ClockCircleOutlined /></span>
      <Typography.Title level={2}>{title}</Typography.Title>
      <Typography.Paragraph>{description}</Typography.Paragraph>
      <span className="coordinator-placeholder__status">Đang hoàn thiện giao diện</span>
    </Card>
  );
}
