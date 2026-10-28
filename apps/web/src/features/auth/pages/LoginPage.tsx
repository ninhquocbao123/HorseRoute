import BrandLogo from '../../../components/BrandLogo';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Alert, Modal } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { login, register as registerApi } from '../../users/api/users.api';
import PublicSymbols from '../../home/PublicSymbols';
import '../../home/landing-page.css';
import './auth-page.css';

type Mode = 'login' | 'register' | 'staff';
const formSchema = (mode: Mode) => z.object({
  email: z.string().trim().email('Nhập email hợp lệ.').max(100),
  password: z.string().min(1, 'Nhập mật khẩu.'),
  fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional(),
  province: z.string().optional(), customerType: z.enum(['INDIVIDUAL', 'CLUB']), organizationName: z.string().optional(),
  confirmPassword: z.string().optional(), acceptTerms: z.boolean(),
}).superRefine((data, ctx) => {
  if (mode !== 'register') return;
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (!data.fullName || data.fullName.trim().length < 2 || data.fullName.trim().length > 100) issue('fullName', 'Nhập họ tên từ 2 đến 100 ký tự.');
  if (!/^\+?[0-9]{9,15}$/.test(data.phone?.trim() || '')) issue('phone', 'Nhập số điện thoại từ 9 đến 15 chữ số.');
  if (!data.address || data.address.trim().length < 5) issue('address', 'Nhập địa chỉ từ 5 ký tự.');

  if ((data.address?.trim() || '').length > 255) issue('address', 'Địa chỉ đầy đủ không được vượt quá 255 ký tự.');
  if (data.customerType === 'CLUB' && !data.organizationName?.trim()) issue('organizationName', 'Nhập tên câu lạc bộ / tổ chức.');
  if (data.password.length < 8 || !data.password.trim() || new TextEncoder().encode(data.password).length > 72) issue('password', 'Ít nhất 8 ký tự, tối đa 72 byte UTF-8.');
  if (data.confirmPassword !== data.password) issue('confirmPassword', 'Mật khẩu nhập lại chưa khớp.');
  if (!data.acceptTerms) issue('acceptTerms', 'Vui lòng xác nhận trước khi tạo tài khoản.');
});
type FormData = z.infer<ReturnType<typeof formSchema>>;

export default function LoginPage() {
  const { pathname } = useLocation();
  const mode: Mode = pathname === '/register' ? 'register' : pathname === '/staff/login' ? 'staff' : 'login';
  return <AuthForm key={mode} mode={mode} />;
}

function AuthForm({ mode }: { mode: Mode }) {
  const { account, loading, syncError, onLoginSuccess } = useAuth();
  const [params] = useSearchParams();
  const isRegister = mode === 'register', staff = mode === 'staff';
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { return localStorage.getItem('hr-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [language, setLanguage] = useState<'vi' | 'en'>(() => { try { return localStorage.getItem('hr-lang') === 'en' ? 'en' : 'vi'; } catch { return 'vi'; } });
  const t = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dialog, setDialog] = useState<'password' | 'terms' | null>(null);
  const { register, handleSubmit, watch, setError: fieldError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(formSchema(mode)),
    defaultValues: { email: '', password: '', fullName: '', phone: '', address: '', province: '', customerType: 'INDIVIDUAL', organizationName: '', confirmPassword: '', acceptTerms: false },
  });
  const busy = loading || isSubmitting;
  const customerType = watch('customerType');
  const password = watch('password');
  if (account) {
    const destination = account.role === 'COORDINATOR'
      ? '/coordinator/dashboard'
      : params.get('order') ? '/dashboard?view=orders' : '/dashboard';
    return <Navigate to={destination} replace />;
  }
  const submit = handleSubmit(async data => {
    setError('');
    try {
      const result = isRegister
        ? await registerApi(data.email, data.password, data.fullName!.trim(), data.phone!.trim(), data.address!.trim(), data.customerType, data.customerType === 'CLUB' ? data.organizationName!.trim() : undefined)
        : await login(data.email, data.password);
      if (staff && result.user.role === 'CUSTOMER') { setError('Đây là tài khoản khách hàng. Vui lòng chọn Đăng nhập khách hàng bên dưới.'); return; }
      if (!staff && !isRegister && result.user.role !== 'CUSTOMER') { setError('Đây là tài khoản nhân viên. Vui lòng chọn Đăng nhập nhân viên bên dưới.'); return; }
      onLoginSuccess(result.accessToken, result.user, isRegister || remember);
    } catch (e) {
      if (isAxiosError(e)) {
        const body = e.response?.data;
        setError(typeof body?.message === 'string' ? body.message : e.response ? 'Chưa thể thực hiện. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Vui lòng thử lại.');
        for (const [key, value] of Object.entries(body?.fields || {})) {
          if (['email', 'password', 'fullName', 'phone', 'address', 'customerType', 'organizationName'].includes(key)) fieldError(key as keyof FormData, { message: String(value) });
        }
      } else setError('Chưa thể kết nối. Vui lòng thử lại.');
    }
  });
  const field = (name: 'email' | 'fullName' | 'phone' | 'address' | 'organizationName', label: string, type = 'text', autoComplete?: string, maxLength = 100) => <><div className="fld"><input {...register(name)} id={name} placeholder=" " type={type} autoComplete={autoComplete} maxLength={maxLength} disabled={busy} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined}/><label htmlFor={name}>{label}</label></div>{errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]?.message}</span>}</>;
  const passwordField = (confirm = false) => {
    const name = confirm ? 'confirmPassword' : 'password';
    const visible = confirm ? confirmVisible : passwordVisible;
    return <><div className="fld"><input {...register(name)} id={name} placeholder=" " type={visible ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} maxLength={72} disabled={busy} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined}/><label htmlFor={name}>{confirm ? t('Nhập lại mật khẩu', 'Confirm password') : t('Mật khẩu', 'Password')}</label><button type="button" className="eye" disabled={busy} aria-label={visible ? t('Ẩn mật khẩu','Hide password') : t('Hiện mật khẩu','Show password')} aria-pressed={visible} onClick={() => confirm ? setConfirmVisible(!visible) : setPasswordVisible(!visible)}>{visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}</button></div>{errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]?.message}</span>}</>;
  };
  const strength = password ? Math.max(1, Number(password.length >= 8) + Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) + Number(/\d/.test(password)) + Number(/[^\w\s]/.test(password))) : 0;
  const colors = ['#d6455d', '#e0a030', '#57c4c4', '#a86a00'];
  const changeTheme = () => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); try { localStorage.setItem('hr-theme', next); } catch {} };
  const changeLanguage = (next: 'vi' | 'en') => { setLanguage(next); try { localStorage.setItem('hr-lang', next); } catch {} };
  const query = params.get('order') ? `?order=${encodeURIComponent(params.get('order')!)}` : '';
  return <main className={`v7-public ${theme === 'dark' ? 'dk' : ''}`} data-theme={theme} lang={language}>
    <PublicSymbols />
    <div id="auth"><div className="ag">
      <aside className="ap"><Link className="logo" to="/"><BrandLogo />{t('Vận chuyển ngựa','Horse transport')}</Link>
        <svg className="big" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="190" fill="none" stroke="#ffffff22" strokeWidth="2"/><circle cx="200" cy="200" r="140" fill="none" stroke="#ffffff22" strokeWidth="2" strokeDasharray="6 10"/><circle cx="200" cy="200" r="90" fill="#ffffff12"/><use href="#hs" x="120" y="120" width="160" height="160" color="#f4b942"/></svg>
        <h2>{staff ? t('Cùng phối hợp, vững từng chặng đường.','Working together, every step of the way.') : t('Chuyến đi của ngựa, bạn luôn nắm trong tay.',"Your horses’ journey, always in your hands.")}</h2>
        <ul>{(staff ? [t('Quản lý công việc theo vai trò','Manage work by role'),t('Kết nối hồ sơ và lịch trình','Connect records and schedules'),t('Cập nhật trên cùng một hệ thống','Stay connected in one system')] : [t('Theo dõi xe trên bản đồ theo thời gian thực','Follow your truck on the map'),t('Xem tiến độ từng giấy tờ kiểm dịch','See progress on quarantine documents'),t('Báo giá rõ ràng trước chuyến đi','Clear quotes before departure')]).map(text => <li key={text}>{text}</li>)}</ul>
      </aside>
      <section className="af"><div className="atop"><Link className="back" to="/">{t('← Về trang chủ','← Back to home')}</Link><div className="tools"><div className="ctl"><div className="lg2" role="radiogroup" aria-label={t('Ngôn ngữ','Language')}><button type="button" role="radio" aria-checked={language === 'vi'} onClick={() => changeLanguage('vi')}>VI</button><button type="button" role="radio" aria-checked={language === 'en'} onClick={() => changeLanguage('en')}>EN</button></div><span className="dv"/><button type="button" className="tg" aria-label={t('Đổi giao diện sáng tối','Toggle light and dark theme')} aria-pressed={theme === 'dark'} onClick={changeTheme}><span className="tk"><svg className="i-s"><use href="#i-sun"/></svg><svg className="i-m"><use href="#i-moon"/></svg></span></button></div></div></div>
        <div className="acard">
          {!staff && <div className="seg" role="tablist" aria-label={t('Tài khoản khách hàng','Customer account')}><Link role="tab" aria-selected={!isRegister} to={`/login${query}`}>{t('Đăng nhập','Log in')}</Link><Link role="tab" aria-selected={isRegister} to={`/register${query}`}>{t('Đăng ký','Sign up')}</Link></div>}
          <form id={isRegister ? 'fr' : 'fl'} onSubmit={submit} noValidate aria-busy={busy}>
            <h1>{isRegister ? t('Tạo tài khoản mới','Create a new account') : staff ? t('Đăng nhập nhân viên','Staff login') : t('Chào mừng trở lại','Welcome back')}</h1>
            <p className="sub2">{isRegister ? t('Chỉ mất một phút để bắt đầu đặt chuyến.','It takes a minute to start booking trips.') : t('Đăng nhập bằng email và mật khẩu của tài khoản.','Log in with your account email and password.')}</p>
            {(error || syncError) && <Alert type="error" showIcon message={error || syncError} style={{ marginBottom: 18 }}/>}
            {isRegister && field('fullName',t('Họ và tên','Full name'),'text','name')}
            {isRegister ? <div className="two"><div>{field('email','Email','email','email')}</div><div>{field('phone',t('Số điện thoại','Phone number'),'tel','tel',16)}</div></div> : field('email','Email','email','email')}
            {isRegister && <><div className="fld"><select id="customerType" {...register('customerType')} disabled={busy}><option value="INDIVIDUAL">{t('Cá nhân','Individual')}</option><option value="CLUB">{t('Câu lạc bộ, trại ngựa','Club or stud farm')}</option></select><label className="up" htmlFor="customerType">{t('Loại tài khoản','Account type')}</label></div>{customerType === 'CLUB' && field('organizationName',t('Tên câu lạc bộ / tổ chức','Club / organization name'),'text','organization',150)}{field('address',t('Địa chỉ','Address'),'text','street-address',255)}</>}
            {passwordField()}
            {isRegister && <><div className="str" aria-label={t('Độ mạnh mật khẩu','Password strength')}>{[0,1,2,3].map(i => <i key={i} style={{background:i < strength ? colors[strength - 1] : undefined}}/>)}<small>{['',t('Yếu','Weak'),t('Trung bình','Fair'),t('Khá','Good'),t('Mạnh','Strong')][strength]}</small></div>{passwordField(true)}<label className="ck" style={{marginBottom:16}}><input type="checkbox" {...register('acceptTerms')} disabled={busy} aria-invalid={!!errors.acceptTerms}/>{t('Tôi đồng ý với điều khoản sử dụng','I agree to the terms of use')}</label>{errors.acceptTerms && <span className="field-error">{errors.acceptTerms.message}</span>}</>}
            {!isRegister && <div className="rowx"><label className="ck"><input type="checkbox" checked={remember} disabled={busy} onChange={e => setRemember(e.target.checked)}/>{t('Ghi nhớ đăng nhập','Remember me')}</label><button className="forgot-link" type="button" onClick={() => setDialog('password')}>{t('Quên mật khẩu?','Forgot password?')}</button></div>}
            <button className="btn dk full" type="submit" disabled={busy}>{busy ? t('Đang xử lý…','Please wait…') : isRegister ? t('Tạo tài khoản','Create account') : t('Đăng nhập','Log in')}</button>
            <p className="sw2">{isRegister ? <>{t('Đã có tài khoản?','Already have an account?')} <Link to={`/login${query}`}>{t('Đăng nhập','Log in')}</Link></> : staff ? <Link to="/login">{t('Đăng nhập khách hàng','Customer login')}</Link> : <>{t('Chưa có tài khoản?','No account yet?')} <Link to={`/register${query}`}>{t('Đăng ký ngay','Sign up now')}</Link></>}</p>
          </form>
          {!staff && <Link className="staff-entry" to="/staff/login">{t('Dành cho nhân viên →','Staff login →')}</Link>}
        </div>
      </section>
    </div></div>
    <Modal open={dialog !== null} title={t('Hỗ trợ khôi phục mật khẩu','Password recovery help')} footer={null} onCancel={() => setDialog(null)}><p>{t('Hệ thống chưa hỗ trợ đặt lại mật khẩu tự động. Vui lòng liên hệ đơn vị quản lý tài khoản để được hỗ trợ.','Automatic password reset is not available yet. Please contact your account administrator for help.')}</p></Modal>
  </main>;
}
