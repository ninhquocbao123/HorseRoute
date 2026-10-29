import AvatarEditor from './AvatarEditor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Modal, Form, Input, Alert } from 'antd';
import { api } from '../lib/axios';
import { isAxiosError } from 'axios';
import { EditOutlined, UserOutlined, MailOutlined, PhoneOutlined, EnvironmentOutlined, SafetyCertificateOutlined, LockOutlined, InboxOutlined, RightOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { IUser } from '@my-project/shared';
import { useAuth } from '../features/auth/hooks/useAuth';
import './account-profile.css';

export default function AccountProfile({account,roleName,children,compact=false}:{account:IUser;roleName:string;children?:ReactNode;compact?:boolean}) {
 const [open,setOpen]=useState(false),[avatarOpen,setAvatarOpen]=useState(false);
 const queryClient=useQueryClient();
 const avatarKey=['account-avatar',account.id];
 const {data:avatar}=useQuery({queryKey:avatarKey,queryFn:async()=>(await api.get('/users/me/avatar')).data.image as string|null,staleTime:60000});
 const navigate=useNavigate();
 const {logout,updateAccount}=useAuth();
 const [editing,setEditing]=useState(false),[passwordOpen,setPasswordOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [profileForm]=Form.useForm(),[passwordForm]=Form.useForm();
 async function save(kind: 'profile' | 'password') {
  const form=kind==='profile'?profileForm:passwordForm;
  let values;try{values=await form.validateFields();}catch{return;}
  setBusy(true);setError('');
  try{if(kind==='profile'){const r=await api.patch('/users/me',values);updateAccount(r.data);setEditing(false);setNotice('Đã cập nhật hồ sơ.');}else{await api.post('/users/me/password',{currentPassword:values.currentPassword,newPassword:values.newPassword});setPasswordOpen(false);passwordForm.resetFields();setNotice('Đã đổi mật khẩu thành công.');}}catch(e){setError(isAxiosError(e)?String(e.response?.data?.message||'Không thể lưu. Vui lòng thử lại.'):'Không thể lưu.');}finally{setBusy(false);}
 }
 const [modal,contextHolder]=Modal.useModal();
 const initial=account.fullName.trim().slice(0,1).toUpperCase()||'?';
 const fields=[{label:'Họ và tên',value:account.fullName,icon:<UserOutlined/>,tone:'blue'},{label:'Email',value:account.email,icon:<MailOutlined/>,tone:'purple'},{label:'Số điện thoại',value:account.phone,icon:<PhoneOutlined/>,tone:'green'},{label:'Địa chỉ',value:account.address,icon:<EnvironmentOutlined/>,tone:'orange'}];
 return <div className={'account-profile'+(compact?' is-compact':'')}>
  {contextHolder}
  <button type="button" className="account-profile-trigger" aria-label={'Xem hồ sơ của '+account.fullName} aria-haspopup="dialog" onClick={()=>setOpen(true)} title={account.fullName}>
   <span className="account-profile-avatar" aria-hidden="true">{avatar?<img src={avatar} alt=""/>:initial}</span>
   {!compact&&<span className="account-profile-name"><strong>{account.fullName}</strong><small>{roleName}</small></span>}
  </button>
  {children&&<div className="account-profile-actions">{children}</div>}
  <Modal title={<span className="profile-sr-only">Hồ sơ tài khoản</span>} open={open} zIndex={1100} maskClosable={!avatarOpen&&!editing&&!passwordOpen} keyboard={!avatarOpen&&!editing&&!passwordOpen} onCancel={()=>{if(!avatarOpen&&!editing&&!passwordOpen)setOpen(false);}} footer={null} width={960} className="profile-reference-modal" destroyOnHidden>
   <div className="profile-v2"><h1>Hồ sơ tài khoản</h1>{notice&&<Alert type="success" title={notice} closable onClose={()=>setNotice('')}/>}
    <div className="profile-v2-layout"><aside className="profile-v2-identity"><div className="profile-v2-avatar">{avatar?<img src={avatar} alt="Ảnh đại diện"/>:<span>{initial}</span>}</div><button className="profile-v2-photo" onClick={()=>setAvatarOpen(true)}>Đổi ảnh đại diện</button><h2>{account.fullName}</h2><span className="profile-role-badge">{roleName}</span><div className="profile-v2-actions">      {account.role==='CUSTOMER'&&<button className="profile-orders profile-card" onClick={()=>{setOpen(false);navigate('/dashboard?view=orders');}}><span className="profile-icon orange"><InboxOutlined/></span><span><strong>Đơn của tôi</strong><small>Xem đơn vận chuyển</small></span><RightOutlined/></button>}
      <div className="profile-signout">{children||<button onClick={()=>{modal.confirm({title:'Đăng xuất khỏi tài khoản?',okText:'Đăng xuất',cancelText:'Ở lại',onOk:logout});}} aria-label="Đăng xuất"><LogoutOutlined/></button>}<span aria-hidden="true">Đăng xuất</span></div>
</div></aside><div className="profile-v2-details">     <section className="profile-card profile-personal"><header><h2>Thông tin cá nhân</h2>      <span className="profile-edit-wrap"><button className="profile-edit" onClick={()=>{setError('');profileForm.setFieldsValue({fullName:account.fullName,phone:account.phone||'',address:account.address||''});setEditing(true);}}><EditOutlined/>Chỉnh sửa hồ sơ</button></span></header><dl>{fields.map(f=><div className="profile-info-row" key={f.label}><span className={'profile-icon '+f.tone}>{f.icon}</span><div><dt>{f.label}</dt><dd>{f.value||'Chưa cập nhật'}</dd></div></div>)}</dl></section>
      <section className="profile-card profile-security"><h2>Tài khoản &amp; bảo mật</h2><div className="profile-info-row"><span className="profile-icon green"><SafetyCertificateOutlined/></span><div><span className="profile-field-label">Vai trò</span><strong>{roleName}</strong></div></div><div className="profile-info-row"><span className="profile-icon blue"><LockOutlined/></span><div><span className="profile-field-label">Mật khẩu</span><strong className="profile-password">••••••••</strong></div><span className="profile-password-action"><button onClick={()=>{setError('');passwordForm.resetFields();setPasswordOpen(true);}}>Đổi mật khẩu</button></span></div></section>
</div></div>
   </div>
  </Modal>
  <AvatarEditor open={avatarOpen} onClose={()=>setAvatarOpen(false)} onSaved={image=>{queryClient.setQueryData(avatarKey,image);setNotice('Đã cập nhật ảnh đại diện.');}}/>
  <Modal zIndex={1200} title="Chỉnh sửa hồ sơ" open={editing} onCancel={()=>{if(!busy)setEditing(false);}} onOk={()=>void save('profile')} confirmLoading={busy} okText="Lưu thay đổi" cancelText="Hủy" closable={!busy} maskClosable={!busy}>
   {error&&<Alert type="error" title={error}/>}
   <Form form={profileForm} layout="vertical" disabled={busy}>
    <Form.Item name="fullName" label="Họ và tên" rules={[{required:true,whitespace:true,message:'Nhập họ và tên.'},{max:100}]}><Input maxLength={100}/></Form.Item>
    <Form.Item name="phone" label="Số điện thoại" rules={[{pattern:/^[+0-9 ()-]*$/,message:'Số điện thoại không hợp lệ.'},{max:20}]}><Input maxLength={20}/></Form.Item>
    <Form.Item name="address" label="Địa chỉ"><Input.TextArea maxLength={255} rows={3}/></Form.Item>
   </Form>
  </Modal>
  <Modal zIndex={1200} title="Đổi mật khẩu" open={passwordOpen} onCancel={()=>{if(!busy){setPasswordOpen(false);passwordForm.resetFields();}}} onOk={()=>void save('password')} confirmLoading={busy} okText="Đổi mật khẩu" cancelText="Hủy" closable={!busy} maskClosable={!busy}>
   {error&&<Alert type="error" title={error}/>}
   <Form form={passwordForm} layout="vertical" disabled={busy}>
    <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{required:true,message:'Nhập mật khẩu hiện tại.'}]}><Input.Password autoComplete="current-password"/></Form.Item>
    <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{required:true,message:'Nhập mật khẩu mới.'},{min:8,message:'Mật khẩu cần ít nhất 8 ký tự.'},{max:72}]}><Input.Password autoComplete="new-password"/></Form.Item>
    <Form.Item name="confirmPassword" label="Xác nhận mật khẩu mới" dependencies={['newPassword']} rules={[{required:true,message:'Nhập lại mật khẩu mới.'},({getFieldValue})=>({validator:(_,value)=>value===getFieldValue('newPassword')?Promise.resolve():Promise.reject(new Error('Mật khẩu xác nhận không khớp.'))})]}><Input.Password autoComplete="new-password"/></Form.Item>
   </Form>
  </Modal>
 </div>;
}
