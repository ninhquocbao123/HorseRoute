import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, Form, Input, Modal } from 'antd';
import { forgotPassword, resendVerification, resetPassword, verifyEmail, type LoginResponse } from '../../users/api/users.api';

const RESEND_SECONDS = 60;
const message = (error: unknown) => {
  if (!isAxiosError(error)) return 'Chưa thực hiện được. Vui lòng thử lại.';
  if (!error.response) return 'Không kết nối được máy chủ. Vui lòng thử lại.';
  if (error.response.status === 429) return 'Bạn thao tác quá nhanh. Đợi một phút rồi thử lại.';
  const body = error.response.data as { message?: string } | undefined;
  return typeof body?.message === 'string' ? body.message : 'Chưa thực hiện được. Vui lòng thử lại.';
};
const codeRules = [{ required: true, message: 'Nhập mã gồm 6 số.' }, { pattern: /^\d{6}$/, message: 'Mã gồm 6 chữ số.' }];
const passwordRules = [
  { required: true, message: 'Nhập mật khẩu mới.' },
  { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
  { max: 72, message: 'Tối đa 72 ký tự.' },
  { pattern: /\S/, message: 'Mật khẩu không được chỉ gồm khoảng trắng.' },
];

/** Đếm ngược tới khi được gửi lại mã. */
function useCooldown(start: boolean) {
  const [left, setLeft] = useState(start ? RESEND_SECONDS : 0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return [left, () => setLeft(RESEND_SECONDS)] as const;
}

/** Nhập mã xác minh email sau khi đăng ký (hoặc khi đăng nhập tài khoản chưa xác minh). Đúng mã thì trả phiên đăng nhập. */
export function VerifyEmailDialog({ email, sent, onVerified, onClose }: { email: string; sent: boolean; onVerified: (session: LoginResponse) => void; onClose: () => void }) {
  const [form] = Form.useForm<{ code: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(sent ? `Đã gửi mã gồm 6 số tới ${email}. Mã có hiệu lực trong 15 phút.` : '');
  const [left, restart] = useCooldown(sent);
  async function submit({ code }: { code: string }) {
    setBusy(true); setError('');
    try { onVerified(await verifyEmail(email, code.trim())); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError('');
    try { setNotice((await resendVerification(email)).message); restart(); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return (
    <Modal open title="Xác minh email" footer={null} onCancel={() => { if (!busy) onClose(); }} destroyOnHidden centered>
      <p>Tài khoản <strong>{email}</strong> cần xác minh email trước khi dùng. Kiểm tra hộp thư (kể cả mục Thư rác) để lấy mã.</p>
      {notice && <Alert type="info" showIcon title={notice} style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      <Form form={form} name="verify-email" layout="vertical" onFinish={values => void submit(values)} disabled={busy}>
        <Form.Item name="code" label="Mã xác minh" rules={codeRules}>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="6 chữ số" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button onClick={() => void resend()} disabled={busy || left > 0}>{left > 0 ? `Gửi lại mã (${left}s)` : 'Gửi lại mã'}</Button>
          <Button type="primary" htmlType="submit" loading={busy}>Xác minh</Button>
        </div>
      </Form>
    </Modal>
  );
}

/** Quên mật khẩu: nhập email nhận mã, rồi nhập mã và mật khẩu mới. */
export function ForgotPasswordDialog({ initialEmail, onClose }: { initialEmail: string; onClose: (done?: string) => void }) {
  const [emailForm] = Form.useForm<{ email: string }>();
  const [resetForm] = Form.useForm<{ code: string; password: string; confirm: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [left, restart] = useCooldown(false);
  async function send(target: string) {
    setBusy(true); setError('');
    try { setNotice((await forgotPassword(target)).message); setEmail(target); setStep('code'); restart(); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function reset(values: { code: string; password: string }) {
    setBusy(true); setError('');
    try { onClose((await resetPassword(email, values.code.trim(), values.password)).message); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return (
    <Modal open title="Quên mật khẩu" footer={null} onCancel={() => { if (!busy) onClose(); }} destroyOnHidden centered>
      {notice && <Alert type="info" showIcon title={notice} style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      {step === 'email' ? (
        <Form form={emailForm} name="forgot-email" layout="vertical" initialValues={{ email: initialEmail }} onFinish={values => void send(values.email.trim())} disabled={busy}>
          <p>Nhập email của tài khoản. Hệ thống gửi một mã gồm 6 số để bạn đặt mật khẩu mới.</p>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email.' }, { type: 'email', message: 'Email không hợp lệ.' }]}>
            <Input type="email" autoComplete="email" maxLength={100} autoFocus />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button type="primary" htmlType="submit" loading={busy}>Gửi mã</Button></div>
        </Form>
      ) : (
        <Form form={resetForm} name="forgot-reset" layout="vertical" onFinish={values => void reset(values)} disabled={busy}>
          <p>Nhập mã đã gửi tới <strong>{email}</strong> và mật khẩu mới. Đặt lại xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</p>
          <Form.Item name="code" label="Mã xác nhận" rules={codeRules}>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="6 chữ số" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu mới" rules={passwordRules}>
            <Input.Password autoComplete="new-password" maxLength={72} />
          </Form.Item>
          <Form.Item name="confirm" label="Nhập lại mật khẩu mới" dependencies={['password']}
            rules={[{ required: true, message: 'Nhập lại mật khẩu.' }, ({ getFieldValue }) => ({ validator: (_rule, value) => !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Mật khẩu nhập lại chưa khớp.')) })]}>
            <Input.Password autoComplete="new-password" maxLength={72} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={() => void send(email)} disabled={busy || left > 0}>{left > 0 ? `Gửi lại mã (${left}s)` : 'Gửi lại mã'}</Button>
            <Button type="primary" htmlType="submit" loading={busy}>Đặt mật khẩu mới</Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
