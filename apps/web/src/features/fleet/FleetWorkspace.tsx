import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { errorMessage } from '../tracking/tracking.api';
import {
  fleetApi, VEHICLE_TYPES, vehicleTypeLabel,
  type Vehicle, type VehicleStatus, type VehicleStatusFilter, type VehicleType, type VehicleUpdateInput,
} from './fleet.api';
import './fleet.css';

type FormValues = { plateOrCode: string; vehicleType: VehicleType; capacityStalls: number; status: VehicleStatus };
const PAGE_SIZE = 10;
const STATUS_OPTIONS: { value: VehicleStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'AVAILABLE', label: 'Sẵn sàng' },
  { value: 'RESERVED', label: 'Đã giữ chỗ' },
  { value: 'IN_TRANSIT', label: 'Đang vận chuyển' },
];

/** Danh mục phương tiện (FR-TRP-01): Coordinator thêm, sửa trạng thái và xóa xe chưa từng dùng. */
export default function FleetWorkspace({ canEdit }: { canEdit: boolean }) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VehicleStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const data = await fleetApi.list({ page, limit: PAGE_SIZE, status, q: query });
      if (current !== requestId.current) return;
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) { setPage(lastPage); return; }
      setItems(data.items);
      setTotal(data.total);
      setLoadError('');
    } catch (error) {
      if (current === requestId.current) setLoadError(errorMessage(error, 'Không tải được danh sách phương tiện. Vui lòng thử lại.'));
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [page, status, query]);
  useEffect(() => { void load(); }, [load]);

  function openForm(vehicle: Vehicle | 'new') {
    setFormError('');
    form.resetFields();
    form.setFieldsValue(vehicle === 'new'
      ? { vehicleType: 'LIGHT', capacityStalls: 2, status: 'AVAILABLE' }
      : { plateOrCode: vehicle.plateOrCode, vehicleType: vehicle.vehicleType, capacityStalls: vehicle.capacityStalls, status: vehicle.status });
    setEditing(vehicle);
  }

  async function submit(values: FormValues) {
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      const base = { plateOrCode: values.plateOrCode.trim(), vehicleType: values.vehicleType, capacityStalls: values.capacityStalls };
      if (editing === 'new') {
        await fleetApi.create(base);
        message.success('Đã thêm phương tiện.');
        setStatus('all'); setSearch(''); setQuery(''); setPage(1);
      } else {
        const input: VehicleUpdateInput = { ...base, status: values.status };
        await fleetApi.update(editing.id, input);
        message.success('Đã cập nhật phương tiện.');
      }
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(errorMessage(error, 'Không lưu được phương tiện. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(vehicle: Vehicle) {
    modal.confirm({
      title: `Xóa phương tiện ${vehicle.plateOrCode}?`,
      content: 'Thao tác này không hoàn tác được. Xe chưa từng được dùng trong kế hoạch nên xóa an toàn.',
      okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Giữ lại', centered: true,
      async onOk() {
        try {
          await fleetApi.remove(vehicle.id);
          message.success('Đã xóa phương tiện.');
          await load();
        } catch (error) {
          message.error(errorMessage(error, 'Không xóa được phương tiện.'));
          throw error;
        }
      },
    });
  }

  const columns: TableColumnsType<Vehicle> = [
    { title: 'Biển số / mã xe', dataIndex: 'plateOrCode', render: (value: string) => <strong>{value}</strong> },
    { title: 'Loại', dataIndex: 'vehicleType', render: (type: VehicleType) => vehicleTypeLabel(type) },
    { title: 'Sức chứa', dataIndex: 'capacityStalls', align: 'right', render: (value: number) => `${value} chỗ` },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (current: VehicleStatus, vehicle) => (
        <span className="fleet-tags">
          <Tag color={current === 'AVAILABLE' ? 'success' : current === 'RESERVED' ? 'warning' : 'processing'}>{current === 'AVAILABLE' ? 'Sẵn sàng' : current === 'RESERVED' ? 'Đã giữ chỗ' : 'Đang vận chuyển'}</Tag>
          {vehicle.inActiveUse && <Tooltip title="Xe nằm trong kế hoạch đã duyệt của đơn chưa giao xong."><Tag color="warning">Đang dùng</Tag></Tooltip>}
        </span>
      ),
    },
    { title: 'Số chặng', dataIndex: 'legCount', align: 'right' },
  ];
  if (canEdit) {
    columns.push({
      title: 'Thao tác', key: 'actions', align: 'right',
      render: (_value, vehicle) => (
        <span className="fleet-actions">
          <Button size="small" onClick={() => openForm(vehicle)} aria-label={`Sửa ${vehicle.plateOrCode}`}>Sửa</Button>
          <Tooltip title={vehicle.legCount > 0 ? 'Xe đã được dùng trong kế hoạch nên không thể xóa.' : ''}>
            <Button size="small" danger disabled={vehicle.legCount > 0} onClick={() => confirmDelete(vehicle)} aria-label={`Xóa ${vehicle.plateOrCode}`}>Xóa</Button>
          </Tooltip>
        </span>
      ),
    });
  }

  return (
    <section className="portal-panel fleet" aria-labelledby="fleet-title">
      <div className="portal-panel-heading">
        <div>
          <h2 id="fleet-title">Danh sách phương tiện</h2>
          <p>Danh mục xe chuyên dụng dùng khi lập kế hoạch chuyến. Chỉ xe đang hoạt động mới được chọn cho chặng.</p>
        </div>
        {canEdit && <Button type="primary" onClick={() => openForm('new')}>Thêm phương tiện</Button>}
      </div>
      <div className="fleet-filters">
        <Input.Search
          allowClear placeholder="Tìm theo biển số / mã xe" maxLength={30} value={search}
          onChange={event => { setSearch(event.target.value); if (!event.target.value) { setQuery(''); setPage(1); } }}
          onSearch={value => { setQuery(value.trim()); setPage(1); }} aria-label="Tìm phương tiện"
        />
        <Select value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} aria-label="Lọc theo trạng thái" />
        <Button onClick={() => void load()} disabled={loading}>Làm mới</Button>
      </div>
      {loadError && <Alert type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
      <Table<Vehicle>
        rowKey="id" size="middle" columns={columns} dataSource={items} loading={loading} scroll={{ x: 'max-content' }}
        locale={{ emptyText: query || status !== 'all' ? 'Không có phương tiện phù hợp bộ lọc.' : 'Chưa có phương tiện nào.' }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage, showTotal: count => `${count} phương tiện` }}
      />

      <Modal
        open={editing !== null} destroyOnHidden centered mask={{ closable: !saving }} keyboard={!saving}
        title={editing === 'new' ? 'Thêm phương tiện' : 'Sửa phương tiện'}
        okText={editing === 'new' ? 'Thêm' : 'Lưu'} cancelText="Hủy" confirmLoading={saving}
        onOk={() => form.submit()} onCancel={() => { if (!saving) setEditing(null); }}
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        {editing !== 'new' && editing?.inActiveUse && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Xe đang nằm trong kế hoạch đã duyệt: không thể đổi trạng thái hoặc giảm sức chứa dưới số ngựa cần chở." />
        )}
        <Form form={form} layout="vertical" onFinish={values => void submit(values)} requiredMark="optional">
          <Form.Item name="plateOrCode" label="Biển số / mã xe" rules={[{ required: true, whitespace: true, message: 'Nhập biển số hoặc mã xe.' }, { max: 30, message: 'Tối đa 30 ký tự.' }]}>
            <Input maxLength={30} autoComplete="off" />
          </Form.Item>
          <Form.Item name="vehicleType" label="Loại phương tiện" rules={[{ required: true, message: 'Chọn loại phương tiện.' }]}>
            <Select options={VEHICLE_TYPES} />
          </Form.Item>
          <Form.Item name="capacityStalls" label="Sức chứa (số chỗ ngựa)" dependencies={['vehicleType']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_rule, value) => { const type = getFieldValue('vehicleType') as VehicleType; const valid = type === 'LIGHT' ? value === 2 : type === 'MEDIUM' ? value >= 4 && value <= 6 : value === 9; return valid ? Promise.resolve() : Promise.reject(new Error(type === 'LIGHT' ? 'Xe nhẹ có đúng 2 chỗ.' : type === 'MEDIUM' ? 'Xe trung có từ 4 đến 6 chỗ.' : 'Xe nặng có đúng 9 chỗ.')); } })]}>
            <InputNumber min={2} max={9} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item name="status" label="Trạng thái" extra="Chỉ xe Sẵn sàng có thể được chọn cho kế hoạch mới.">
              <Select options={STATUS_OPTIONS.filter(option => option.value !== 'all')} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </section>
  );
}
