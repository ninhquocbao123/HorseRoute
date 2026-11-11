import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { useFeedback } from '../../components/useFeedback';
import { errorMessage } from '../tracking/tracking.api';
import { accountsApi, kindLabel, statusLabel, STAFF_KINDS, workLabel, type Account, type AccountStatus, type StaffKind } from './accounts.api';
import './accounts.css';

const PAGE_SIZE = 10;
const KIND_FILTERS = [{ value: 'STAFF', label: 'Mọi nhân sự' }, ...STAFF_KINDS, { value: 'CUSTOMER', label: 'Khách hàng' }];
const STATUS_COLORS: Record<AccountStatus, string> = { ACTIVE: 'green', LOCKED: 'red', PENDING: 'gold' };
const passwordRules = [
  { required: true, message: 'Nhập mật khẩu.' },
  { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
  { max: 72, message: 'Tối đa 72 ký tự.' },
  { pattern: /\S/, message: 'Mật khẩu không được chỉ gồm khoảng trắng.' },
];
type Dialog = { type: 'create' } | { type: 'edit' | 'lock' | 'unlock' | 'password'; account: Account } | null;

/** Quản trị tài khoản (A3): ADMIN tạo nhân sự, đổi vai trò, khóa và mở, đặt lại mật khẩu. Khách tự đăng ký; ở đây chỉ khóa hoặc mở. */
export default function AccountsWorkspace({ currentUserId }: { currentUserId: string }) {
  const { message } = useFeedback();
  const [form] = Form.useForm();
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('STAFF');
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const data = await accountsApi.list({ page, limit: PAGE_SIZE, kind, status, q: query });
      if (id !== request.current) return;
      setItems(data.items); setTotal(data.total); setLoadError('');
    } catch (error) {
      if (id === request.current) setLoadError(errorMessage(error, 'Không tải được danh sách tài khoản.'));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [page, kind, status, query]);
  useEffect(() => { void load(); }, [load]);

  function open(next: Dialog) {
    form.resetFields();
    setFormError('');
    if (next?.type === 'create') form.setFieldsValue({ kind: 'DRIVER' });
    if (next?.type === 'edit') form.setFieldsValue({ fullName: next.account.fullName, phone: next.account.phone ?? '', kind: next.account.kind });
    setDialog(next);
  }

  async function submit(values: Record<string, string>) {
    if (!dialog) return;
    setSaving(true);
    setFormError('');
    try {
      if (dialog.type === 'create') {
        const made = await accountsApi.create({ email: values.email, fullName: values.fullName, phone: values.phone || undefined, kind: values.kind as StaffKind, password: values.password });
        void message.success(`Đã tạo tài khoản ${made.email}. Gửi mật khẩu cho người dùng qua kênh riêng.`);
      } else if (dialog.type === 'edit') {
        const changeKind = dialog.account.role !== 'CUSTOMER' && values.kind !== dialog.account.kind;
        await accountsApi.update(dialog.account.id, { fullName: values.fullName, phone: values.phone ?? '', ...(changeKind ? { kind: values.kind as StaffKind } : {}) });
        void message.success('Đã lưu thay đổi.');
      } else if (dialog.type === 'lock' || dialog.type === 'unlock') {
        await accountsApi.setLocked(dialog.account.id, dialog.type === 'lock', values.reason);
        void message.success(dialog.type === 'lock' ? 'Đã khóa tài khoản. Người dùng bị đăng xuất ngay.' : 'Đã mở khóa tài khoản.');
      } else {
        const result = await accountsApi.resetPassword(dialog.account.id, values.password);
        void message.success(result.message);
      }
      setDialog(null);
      await load();
    } catch (error) {
      const fields = isAxiosError(error) ? (error.response?.data as { fields?: Record<string, string> } | undefined)?.fields : undefined;
      if (fields) form.setFields(Object.entries(fields).map(([name, text]) => ({ name, errors: [text] })));
      setFormError(errorMessage(error, 'Chưa lưu được. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumnsType<Account> = [
    {
      title: 'Họ tên', key: 'name', width: 220,
      render: (_, a) => <div className="accounts-name"><strong>{a.fullName}</strong><small>{a.email}</small></div>,
    },
    { title: 'Vai trò', key: 'kind', width: 100, render: (_, a) => kindLabel(a.kind) },
    { title: 'Điện thoại', dataIndex: 'phone', width: 115, render: (phone: string | null) => phone || <span className="accounts-muted">Chưa có</span> },
    {
      title: 'Trạng thái', key: 'status', width: 130,
      render: (_, a) => <span className="accounts-tags"><Tag color={STATUS_COLORS[a.status]}>{statusLabel[a.status]}</Tag>{a.workStatus && a.workStatus !== 'AVAILABLE' && <Tag>{workLabel[a.workStatus]}</Tag>}</span>,
    },
    { title: 'Tạo lúc', dataIndex: 'createdAt', width: 100, className: 'accounts-nowrap', render: (value: string) => new Date(value).toLocaleDateString('vi-VN') },
    {
      title: 'Thao tác', key: 'actions',
      render: (_, a) => {
        const self = a.id === currentUserId;
        const busyCrew = a.workStatus && a.workStatus !== 'AVAILABLE';
        const lockHint = self ? 'Không tự khóa tài khoản của mình.' : busyCrew ? 'Nhân sự đang được giữ chỗ hoặc đang chạy chuyến.' : '';
        return (
          <Space size={6} wrap>
            <Button size="small" onClick={() => open({ type: 'edit', account: a })} aria-label={`Sửa ${a.email}`}>Sửa</Button>
            <Button size="small" onClick={() => open({ type: 'password', account: a })} aria-label={`Đặt lại mật khẩu ${a.email}`}>Đặt lại mật khẩu</Button>
            {a.status === 'LOCKED'
              ? <Button size="small" onClick={() => open({ type: 'unlock', account: a })} aria-label={`Mở khóa ${a.email}`}>Mở khóa</Button>
              : <Tooltip title={lockHint}><Button size="small" danger disabled={!!lockHint} onClick={() => open({ type: 'lock', account: a })} aria-label={`Khóa ${a.email}`}>Khóa</Button></Tooltip>}
          </Space>
        );
      },
    },
  ];

  const title = dialog?.type === 'create' ? 'Tạo tài khoản nhân sự'
    : dialog?.type === 'edit' ? `Sửa ${dialog.account.email}`
    : dialog?.type === 'lock' ? `Khóa ${dialog.account.email}`
    : dialog?.type === 'unlock' ? `Mở khóa ${dialog.account.email}`
    : dialog ? `Đặt lại mật khẩu ${dialog.account.email}` : '';
  const editingCustomer = dialog?.type === 'edit' && dialog.account.role === 'CUSTOMER';
  const editingSelf = dialog?.type === 'edit' && dialog.account.id === currentUserId;

  return (
    <section className="portal-panel accounts" aria-labelledby="accounts-title">
      <div className="accounts-heading">
        <div>
          <h2 id="accounts-title">Tài khoản</h2>
          <p>Tạo tài khoản cho nhân sự, đổi vai trò, khóa khi nghỉ việc. Khách hàng tự đăng ký trên trang chủ.</p>
        </div>
        <Button type="primary" onClick={() => open({ type: 'create' })}>Tạo tài khoản</Button>
      </div>
      <div className="accounts-filters">
        <Input.Search allowClear placeholder="Tìm email, họ tên, điện thoại" maxLength={100} value={search} aria-label="Tìm tài khoản"
          onChange={e => { setSearch(e.target.value); if (!e.target.value) { setQuery(''); setPage(1); } }}
          onSearch={value => { setQuery(value.trim()); setPage(1); }} />
        <Select value={kind} options={KIND_FILTERS} aria-label="Lọc theo vai trò" onChange={value => { setKind(value); setPage(1); }} />
        <Select allowClear placeholder="Mọi trạng thái" value={status} aria-label="Lọc theo trạng thái"
          options={(Object.keys(statusLabel) as AccountStatus[]).map(value => ({ value, label: statusLabel[value] }))}
          onChange={value => { setStatus(value); setPage(1); }} />
        <Button onClick={() => void load()} disabled={loading}>Làm mới</Button>
      </div>
      {loadError && <Alert type="error" showIcon title={loadError} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
      <Table<Account>
        rowKey="id" size="middle" loading={loading} dataSource={items} columns={columns} scroll={{ x: 'max-content' }}
        locale={{ emptyText: query || status ? 'Không có tài khoản phù hợp.' : 'Chưa có tài khoản.' }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage }}
      />
      <Modal title={title} open={!!dialog} centered destroyOnHidden confirmLoading={saving}
        okText={dialog?.type === 'create' ? 'Tạo' : dialog?.type === 'lock' ? 'Khóa' : dialog?.type === 'unlock' ? 'Mở khóa' : 'Lưu'}
        okButtonProps={{ danger: dialog?.type === 'lock' }} cancelText="Hủy"
        onOk={() => form.submit()} onCancel={() => { if (!saving) setDialog(null); }}>
        {formError && <Alert type="error" showIcon title={formError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" requiredMark onFinish={values => void submit(values)} disabled={saving}>
          {dialog?.type === 'create' && <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email.' }, { type: 'email', message: 'Email không hợp lệ.' }]}>
            <Input autoComplete="off" maxLength={100} />
          </Form.Item>}
          {(dialog?.type === 'create' || dialog?.type === 'edit') && <>
            <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên.' }]}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item name="phone" label="Điện thoại" rules={[{ pattern: /^[+0-9 ()-]*$/, message: 'Số điện thoại không hợp lệ.' }]}>
              <Input maxLength={20} />
            </Form.Item>
            <Form.Item name="kind" label="Vai trò" rules={[{ required: !editingCustomer, message: 'Chọn vai trò.' }]}
              extra={editingCustomer ? 'Tài khoản khách hàng không đổi sang nhân sự được.' : editingSelf ? 'Không tự đổi vai trò của chính mình.'
                : 'Tài xế và hộ tống được tạo kèm hồ sơ tổ lái để điều phối chọn khi phân công.'}>
              <Select options={editingCustomer ? [{ value: 'CUSTOMER', label: 'Khách hàng' }] : [...STAFF_KINDS]} disabled={editingCustomer || editingSelf} />
            </Form.Item>
          </>}
          {(dialog?.type === 'create' || dialog?.type === 'password') && <Form.Item name="password" label={dialog.type === 'create' ? 'Mật khẩu ban đầu' : 'Mật khẩu mới'} rules={passwordRules}
            extra="Gửi mật khẩu cho người dùng qua kênh riêng và nhắc họ đổi sau khi đăng nhập.">
            <Input.Password autoComplete="new-password" maxLength={72} />
          </Form.Item>}
          {(dialog?.type === 'lock' || dialog?.type === 'unlock') && <>
            {dialog.type === 'lock' && <p>Người dùng bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa.</p>}
            <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: 'Nêu lý do.' }]}>
              <Input.TextArea rows={3} maxLength={255} showCount />
            </Form.Item>
          </>}
        </Form>
      </Modal>
    </section>
  );
}
