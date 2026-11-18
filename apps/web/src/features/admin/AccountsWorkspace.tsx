import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Tooltip,
} from 'antd';
import {
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useFeedback } from '../../components/useFeedback';
import { errorMessage } from '../tracking/tracking.api';
import {
  accountsApi,
  kindLabel,
  statusLabel,
  STAFF_KINDS,
  workLabel,
  type Account,
  type AccountStatus,
  type StaffKind,
} from './accounts.api';

const PAGE_SIZE = 10;

const ROLE_BADGE_CLASS: Record<string, string> = {
  ADMIN: 'adm-badge-admin',
  MANAGER: 'adm-badge-manager',
  SPECIALIST: 'adm-badge-specialist',
  COORDINATOR: 'adm-badge-coordinator',
  DRIVER: 'adm-badge-driver',
  ESCORT: 'adm-badge-escort',
  CUSTOMER: 'adm-badge-customer',
};

const passwordRules = [
  { required: true, message: 'Nhập mật khẩu.' },
  { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
  { max: 72, message: 'Tối đa 72 ký tự.' },
  { pattern: /\S/, message: 'Mật khẩu không được chỉ gồm khoảng trắng.' },
];

type Dialog =
  | { type: 'create' }
  | { type: 'edit' | 'lock' | 'unlock' | 'password'; account: Account }
  | null;

type Props = {
  currentUserId: string;
  initialRoleFilter?: string;
  onDataChanged?: () => void;
};

export default function AccountsWorkspace({
  currentUserId,
  initialRoleFilter,
  onDataChanged,
}: Props) {
  const { message } = useFeedback();
  const [form] = Form.useForm();
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'STAFF' | 'CUSTOMER' | 'CREW'>('ALL');
  const [roleSelect, setRoleSelect] = useState<string>('ALL');
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const request = useRef(0);

  // Sync initialRoleFilter from parent (e.g. clicking a role card on Overview)
  useEffect(() => {
    if (initialRoleFilter) {
      if (initialRoleFilter === 'ALL') {
        setTabFilter('ALL');
        setRoleSelect('ALL');
      } else if (initialRoleFilter === 'STAFF') {
        setTabFilter('STAFF');
        setRoleSelect('ALL');
      } else if (initialRoleFilter === 'CUSTOMER') {
        setTabFilter('CUSTOMER');
        setRoleSelect('ALL');
      } else if (initialRoleFilter === 'DRIVER' || initialRoleFilter === 'ESCORT') {
        setTabFilter('CREW');
        setRoleSelect(initialRoleFilter);
      } else {
        setTabFilter('STAFF');
        setRoleSelect(initialRoleFilter);
      }
      setPage(1);
    }
  }, [initialRoleFilter]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      let filterKind: string | undefined = undefined;
      if (roleSelect !== 'ALL') {
        filterKind = roleSelect;
      } else if (tabFilter === 'STAFF') {
        filterKind = 'STAFF';
      } else if (tabFilter === 'CUSTOMER') {
        filterKind = 'CUSTOMER';
      }

      const data = await accountsApi.list({
        page,
        limit: PAGE_SIZE,
        kind: filterKind,
        status,
        q: query,
      });

      if (id !== request.current) return;

      // In case CREW tab is selected without specific role, filter on frontend or keep driver/escort
      let resultItems = data.items;
      if (tabFilter === 'CREW' && roleSelect === 'ALL') {
        resultItems = resultItems.filter(i => i.kind === 'DRIVER' || i.kind === 'ESCORT');
      }

      setItems(resultItems);
      setTotal(data.total);
      setLoadError('');
    } catch (error) {
      if (id === request.current) {
        setLoadError(errorMessage(error, 'Không tải được danh sách tài khoản.'));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [page, tabFilter, roleSelect, status, query]);

  useEffect(() => {
    void load();
  }, [load]);

  function open(next: Dialog) {
    form.resetFields();
    setFormError('');
    if (next?.type === 'create') form.setFieldsValue({ kind: 'DRIVER' });
    if (next?.type === 'edit') {
      form.setFieldsValue({
        fullName: next.account.fullName,
        phone: next.account.phone ?? '',
        kind: next.account.kind,
      });
    }
    setDialog(next);
  }

  function generateRandomPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldsValue({ password: pwd });
  }

  async function submit(values: Record<string, string>) {
    if (!dialog) return;
    setSaving(true);
    setFormError('');
    try {
      if (dialog.type === 'create') {
        const made = await accountsApi.create({
          email: values.email,
          fullName: values.fullName,
          phone: values.phone || undefined,
          kind: values.kind as StaffKind,
          password: values.password,
        });
        void message.success(`Đã tạo tài khoản ${made.email}. Vui lòng gửi mật khẩu cho nhân sự.`);
      } else if (dialog.type === 'edit') {
        const changeKind =
          dialog.account.role !== 'CUSTOMER' && values.kind !== dialog.account.kind;
        await accountsApi.update(dialog.account.id, {
          fullName: values.fullName,
          phone: values.phone ?? '',
          ...(changeKind ? { kind: values.kind as StaffKind } : {}),
        });
        void message.success('Đã lưu thay đổi.');
      } else if (dialog.type === 'lock' || dialog.type === 'unlock') {
        await accountsApi.setLocked(dialog.account.id, dialog.type === 'lock', values.reason);
        void message.success(
          dialog.type === 'lock'
            ? 'Đã khóa tài khoản. Người dùng bị đăng xuất ngay lập tức.'
            : 'Đã mở khóa tài khoản.'
        );
      } else {
        const result = await accountsApi.resetPassword(dialog.account.id, values.password);
        void message.success(result.message);
      }
      setDialog(null);
      await load();
      onDataChanged?.();
    } catch (error) {
      const fields = isAxiosError(error)
        ? (error.response?.data as { fields?: Record<string, string> } | undefined)?.fields
        : undefined;
      if (fields) {
        form.setFields(Object.entries(fields).map(([name, text]) => ({ name, errors: [text] })));
      }
      setFormError(errorMessage(error, 'Chưa lưu được. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle =
    dialog?.type === 'create'
      ? 'Tạo tài khoản nhân sự mới'
      : dialog?.type === 'edit'
      ? `Chỉnh sửa: ${dialog.account.email}`
      : dialog?.type === 'lock'
      ? `Khóa tài khoản: ${dialog.account.email}`
      : dialog?.type === 'unlock'
      ? `Mở khóa tài khoản: ${dialog.account.email}`
      : dialog
      ? `Đặt lại mật khẩu: ${dialog.account.email}`
      : '';

  const editingCustomer = dialog?.type === 'edit' && dialog.account.role === 'CUSTOMER';
  const editingSelf = dialog?.type === 'edit' && dialog.account.id === currentUserId;

  return (
    <div className="adm-card">
      {/* Top Filter Bar (Styled exactly like .mgr-filter) */}
      <div className="adm-filter">
        <button
          className={tabFilter === 'ALL' && roleSelect === 'ALL' ? 'active' : ''}
          onClick={() => {
            setTabFilter('ALL');
            setRoleSelect('ALL');
            setPage(1);
          }}
        >
          Tất cả tài khoản
        </button>

        <button
          className={tabFilter === 'STAFF' && roleSelect === 'ALL' ? 'active' : ''}
          onClick={() => {
            setTabFilter('STAFF');
            setRoleSelect('ALL');
            setPage(1);
          }}
        >
          Nhân sự (Staff)
        </button>

        <button
          className={tabFilter === 'CUSTOMER' ? 'active' : ''}
          onClick={() => {
            setTabFilter('CUSTOMER');
            setRoleSelect('ALL');
            setPage(1);
          }}
        >
          Khách hàng (Customer)
        </button>

        <button
          className={tabFilter === 'CREW' ? 'active' : ''}
          onClick={() => {
            setTabFilter('CREW');
            setRoleSelect('ALL');
            setPage(1);
          }}
        >
          Tổ lái (Lái xe / Hộ tống)
        </button>

        <Button
          className="adm-gold"
          icon={<PlusOutlined />}
          onClick={() => open({ type: 'create' })}
        >
          + Thêm tài khoản nhân sự
        </Button>
      </div>

      {/* Second filter row: Search, fine role select, status select */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
          placeholder="Tìm theo email, họ tên, điện thoại..."
          value={search}
          allowClear
          style={{ width: 260, height: 40 }}
          onChange={e => {
            setSearch(e.target.value);
            if (!e.target.value) {
              setQuery('');
              setPage(1);
            }
          }}
          onPressEnter={() => {
            setQuery(search.trim());
            setPage(1);
          }}
        />

        <Select
          value={roleSelect}
          style={{ width: 170, height: 40 }}
          options={[
            { value: 'ALL', label: 'Tất cả vị trí' },
            ...STAFF_KINDS,
            { value: 'CUSTOMER', label: 'Khách hàng' },
          ]}
          onChange={val => {
            setRoleSelect(val);
            setPage(1);
          }}
        />

        <Select
          allowClear
          placeholder="Trạng thái"
          value={status}
          style={{ width: 140, height: 40 }}
          options={(Object.keys(statusLabel) as AccountStatus[]).map(value => ({
            value,
            label: statusLabel[value],
          }))}
          onChange={val => {
            setStatus(val);
            setPage(1);
          }}
        />

        <Button
          icon={<ReloadOutlined />}
          style={{ height: 40 }}
          onClick={() => void load()}
          disabled={loading}
        >
          Làm mới
        </Button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          Hiển thị <strong>{items.length}</strong> / <strong>{total}</strong> tài khoản
        </span>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          title={loadError}
          action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Table (Strictly matched with .mgr table design) */}
      <div className="adm-table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>HỌ TÊN &amp; EMAIL</th>
              <th style={{ width: '16%' }}>VAI TRÒ</th>
              <th style={{ width: '15%' }}>ĐIỆN THOẠI</th>
              <th style={{ width: '16%' }}>TRẠNG THÁI</th>
              <th style={{ width: '10%' }}>NGÀY TẠO</th>
              <th style={{ width: '15%', textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {items.map(a => {
              const isSelf = a.id === currentUserId;
              const busyCrew = a.workStatus && a.workStatus !== 'AVAILABLE';
              const lockHint = isSelf
                ? 'Không tự khóa tài khoản của chính mình.'
                : busyCrew
                ? 'Nhân sự đang được giữ chỗ hoặc đang chạy chuyến xe.'
                : '';

              const badgeRole = ROLE_BADGE_CLASS[a.kind] || 'adm-badge-customer';

              return (
                <tr key={a.id}>
                  <td>
                    <b>{a.fullName}</b>
                    <small>{a.email}</small>
                  </td>
                  <td>
                    <span className={`adm-badge ${badgeRole}`}>
                      {kindLabel(a.kind)}
                    </span>
                  </td>
                  <td>
                    {a.phone ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.phone}</span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>Chưa có</span>
                    )}
                  </td>
                  <td>
                    <Space size={4} wrap>
                      <span
                        className={`adm-badge ${
                          a.status === 'ACTIVE'
                            ? 'adm-badge-active'
                            : a.status === 'LOCKED'
                            ? 'adm-badge-locked'
                            : 'adm-badge-pending'
                        }`}
                      >
                        ● {statusLabel[a.status]}
                      </span>

                      {a.workStatus && a.workStatus !== 'AVAILABLE' && (
                        <span className="adm-badge" style={{ background: '#eef2f5', color: '#4a607a' }}>
                          {workLabel[a.workStatus]}
                        </span>
                      )}
                    </Space>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Space size={6}>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => open({ type: 'edit', account: a })}
                        aria-label={`Sửa ${a.email}`}
                      >
                        Sửa
                      </Button>

                      <Tooltip title="Đặt lại mật khẩu">
                        <Button
                          size="small"
                          icon={<KeyOutlined />}
                          onClick={() => open({ type: 'password', account: a })}
                          aria-label={`Đặt lại mật khẩu ${a.email}`}
                        >
                          Mật khẩu
                        </Button>
                      </Tooltip>

                      {a.status === 'LOCKED' ? (
                        <Button
                          size="small"
                          icon={<UnlockOutlined />}
                          style={{ color: '#3e9262', borderColor: '#b7eb8f' }}
                          onClick={() => open({ type: 'unlock', account: a })}
                          aria-label={`Mở khóa ${a.email}`}
                        >
                          Mở khóa
                        </Button>
                      ) : (
                        <Tooltip title={lockHint}>
                          <Button
                            size="small"
                            danger
                            icon={<LockOutlined />}
                            disabled={!!lockHint}
                            onClick={() => open({ type: 'lock', account: a })}
                            aria-label={`Khóa ${a.email}`}
                          >
                            Khóa
                          </Button>
                        </Tooltip>
                      )}
                    </Space>
                  </td>
                </tr>
              );
            })}

            {!items.length && !loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Empty
                    description={
                      query || status || roleSelect !== 'ALL'
                        ? 'Không tìm thấy tài khoản phù hợp với điều kiện lọc'
                        : 'Chưa có tài khoản nào'
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          showSizeChanger={false}
          onChange={setPage}
          style={{ textAlign: 'right', marginTop: 18 }}
        />
      )}

      {/* Modal Dialog */}
      <Modal
        title={dialogTitle}
        open={!!dialog}
        centered
        destroyOnHidden
        confirmLoading={saving}
        okText={
          dialog?.type === 'create'
            ? 'Tạo tài khoản'
            : dialog?.type === 'lock'
            ? 'Khóa tài khoản'
            : dialog?.type === 'unlock'
            ? 'Mở khóa'
            : 'Lưu thay đổi'
        }
        okButtonProps={{
          danger: dialog?.type === 'lock',
          className: dialog?.type !== 'lock' ? 'adm-gold' : undefined,
        }}
        cancelText="Hủy"
        onOk={() => form.submit()}
        onCancel={() => {
          if (!saving) setDialog(null);
        }}
      >
        {formError && (
          <Alert type="error" showIcon title={formError} style={{ marginBottom: 16 }} />
        )}

        <Form
          form={form}
          layout="vertical"
          requiredMark
          onFinish={values => void submit(values)}
          disabled={saving}
        >
          {dialog?.type === 'create' && (
            <Form.Item
              name="email"
              label="Email đăng nhập"
              rules={[
                { required: true, message: 'Nhập email.' },
                { type: 'email', message: 'Email không hợp lệ.' },
              ]}
            >
              <Input autoComplete="off" maxLength={100} placeholder="nhansu@horseroute.vn" />
            </Form.Item>
          )}

          {(dialog?.type === 'create' || dialog?.type === 'edit') && (
            <>
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, whitespace: true, message: 'Nhập họ tên.' }]}
              >
                <Input maxLength={100} placeholder="Nguyễn Văn A" />
              </Form.Item>

              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[{ pattern: /^[+0-9 ()-]*$/, message: 'Số điện thoại không hợp lệ.' }]}
              >
                <Input maxLength={20} placeholder="0901234567" />
              </Form.Item>

              <Form.Item
                name="kind"
                label="Vai trò"
                rules={[{ required: !editingCustomer, message: 'Chọn vai trò.' }]}
                extra={
                  editingCustomer
                    ? 'Tài khoản khách hàng không thể chuyển sang nhân sự.'
                    : editingSelf
                    ? 'Không tự đổi vai trò của chính mình.'
                    : 'Tài xế và hộ tống sẽ tự động được liên kết hồ sơ tổ lái để điều phối chọn khi phân công.'
                }
              >
                <Select
                  options={
                    editingCustomer
                      ? [{ value: 'CUSTOMER', label: 'Khách hàng' }]
                      : [...STAFF_KINDS]
                  }
                  disabled={editingCustomer || editingSelf}
                />
              </Form.Item>
            </>
          )}

          {(dialog?.type === 'create' || dialog?.type === 'password') && (
            <Form.Item
              name="password"
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span>{dialog.type === 'create' ? 'Mật khẩu ban đầu' : 'Mật khẩu mới'}</span>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={generateRandomPassword}
                  >
                    🎲 Tạo ngẫu nhiên
                  </Button>
                </div>
              }
              rules={passwordRules}
              extra="Gửi mật khẩu cho người dùng qua kênh riêng và nhắc họ đổi sau khi đăng nhập."
            >
              <Input.Password autoComplete="new-password" maxLength={72} placeholder="Nhập ít nhất 8 ký tự..." />
            </Form.Item>
          )}

          {(dialog?.type === 'lock' || dialog?.type === 'unlock') && (
            <>
              {dialog.type === 'lock' && (
                <div style={{ background: '#fff0ed', border: '1px solid #ffd5cc', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#b75c47', lineHeight: 1.5 }}>
                  ⚠️ Người dùng sẽ bị đăng xuất ngay lập tức và không thể đăng nhập cho tới khi được mở khóa.
                </div>
              )}
              <Form.Item
                name="reason"
                label="Lý do"
                rules={[{ required: true, whitespace: true, message: 'Nêu lý do.' }]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={255}
                  showCount
                  placeholder="Ví dụ: Nghỉ việc, vi phạm quy định công ty, hoặc yêu cầu bảo mật..."
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
