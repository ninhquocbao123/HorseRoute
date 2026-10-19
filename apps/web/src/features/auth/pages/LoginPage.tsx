import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Alert, Button, Form, Input } from 'antd';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { login, register as registerApi } from '../../users/api/users.api';
import { Brand } from '../../home/LandingPage';
const schema=z.object({email:z.string().trim().email('Nhập email hợp lệ.').max(100),password:z.string().min(1,'Nhập mật khẩu.'),fullName:z.string().optional(),phone:z.string().optional(),address:z.string().optional()});
type FormData=z.infer<typeof schema>;
export default function LoginPage(){
 const {account,loading,onLoginSuccess}=useAuth();
 const [isRegister,setIsRegister]=useState(false),[error,setError]=useState('');
 const {control,handleSubmit,setError:fieldError,clearErrors,resetField,formState:{errors,isSubmitting}}=useForm<FormData>({
  resolver:zodResolver(schema),
  defaultValues:{email:'',password:'',fullName:'',phone:'',address:''},
 });
 if(account)return <Navigate to="/dashboard" replace/>;
 const busy=loading||isSubmitting;
 const submit=handleSubmit(async data=>{
  setError('');
  if(isRegister){
   let invalid=false;
   const fail=(field:keyof FormData,message:string)=>{fieldError(field,{message});invalid=true;};
   if(!data.fullName||data.fullName.trim().length<2||data.fullName.trim().length>100)fail('fullName','Nhập họ tên từ 2 đến 100 ký tự.');
   if(!/^\+?[0-9]{9,15}$/.test(data.phone?.trim()||''))fail('phone','Nhập 9–15 chữ số, có thể bắt đầu bằng +.');
   if(!data.address||data.address.trim().length<5||data.address.trim().length>255)fail('address','Nhập địa chỉ nhà từ 5 đến 255 ký tự.');
   if(data.password.length<8||!data.password.trim()||new TextEncoder().encode(data.password).length>72)fail('password','Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.');
   if(invalid)return;
  }
  try{const result=isRegister?await registerApi(data.email,data.password,data.fullName!.trim(),data.phone!.trim(),data.address!.trim()):await login(data.email,data.password);onLoginSuccess(result.accessToken,result.user);}
  catch(e){if(isAxiosError(e)){const body=e.response?.data;setError(typeof body?.message==='string'?body.message:'Chưa thể thực hiện. Vui lòng thử lại.');for(const [key,message] of Object.entries(body?.fields||{})){if(['email','password','fullName','phone','address'].includes(key))fieldError(key as keyof FormData,{message:String(message)});}}else setError('Không kết nối được máy chủ. Hãy thử lại.');}
 });
 const field=(name:keyof FormData,label:string,type:string,autoComplete:string,maxLength:number)=><Form.Item label={label} required validateStatus={errors[name]?'error':undefined} help={errors[name]?.message}><Controller name={name} control={control} render={({field:inputField})=><Input {...inputField} value={inputField.value??''} id={name} type={type} autoComplete={autoComplete} maxLength={maxLength} disabled={busy} status={errors[name]?'error':undefined} aria-invalid={!!errors[name]}/>} /></Form.Item>;
 return <main className={'auth-page '+(isRegister?'auth-register':'')}><section className="auth-story"><div className="auth-story-content"><Brand/><div><p className="eyebrow">WDP EQUINE TRANSPORT</p><h1>Mọi chặng đường,<br/>luôn có người<br/><em>đồng hành.</em></h1><p>Quản lý yêu cầu, chuẩn bị hồ sơ và theo dõi hành trình trong một không gian.</p></div><small>CHĂM SÓC · KẾT NỐI · ĐỒNG HÀNH</small></div></section><section className="auth-panel"><Link className="back-link" to="/">← Về trang chủ</Link><div className="auth-form-wrap"><p className="eyebrow">KHÔNG GIAN CỦA BẠN</p><h2>{isRegister?'Tạo tài khoản khách hàng.':'Chào mừng trở lại.'}</h2><p className="auth-description">{isRegister?'Điền đầy đủ 5 thông tin dưới đây để bắt đầu tạo yêu cầu vận chuyển.':'Đăng nhập bằng email và mật khẩu của tài khoản WDP.'}</p><Form className="auth-ant-form" component="div" layout="vertical" requiredMark={false}><form noValidate onSubmit={submit}>
 {isRegister&&field('fullName','Họ và tên','text','name',100)}
 {field('email','Email','email','email',100)}
 {isRegister&&field('phone','Số điện thoại','tel','tel',16)}
 <Form.Item label="Mật khẩu" required validateStatus={errors.password?'error':undefined} help={errors.password?.message||(isRegister?'Ít nhất 8 ký tự. Không dùng mật khẩu chỉ gồm khoảng trắng.':undefined)}><Controller name="password" control={control} render={({field})=><Input.Password {...field} value={field.value??''} key={isRegister?'register-password':'login-password'} id="password" autoComplete={isRegister?'new-password':'current-password'} disabled={busy} maxLength={72} status={errors.password?'error':undefined} aria-invalid={!!errors.password}/>} /></Form.Item>
 {isRegister&&field('address','Địa chỉ nhà','text','street-address',255)}
 {error&&<Alert className="auth-form-alert" type="error" showIcon message={error}/>}<Button type="primary" htmlType="submit" className="submit-button" loading={busy} disabled={busy} block>{isRegister?'Tạo tài khoản':'Đăng nhập'}<span aria-hidden="true">↗</span></Button></form></Form><p className="auth-switch">{isRegister?'Đã có tài khoản?':'Chưa có tài khoản?'} <Button type="link" htmlType="button" disabled={busy} onClick={()=>{setIsRegister(!isRegister);clearErrors();resetField('password');setError('');}}>{isRegister?'Đăng nhập':'Đăng ký ngay'}</Button></p></div><p className="auth-copyright">© {new Date().getFullYear()} WDP Equine Transport</p></section></main>;
}
