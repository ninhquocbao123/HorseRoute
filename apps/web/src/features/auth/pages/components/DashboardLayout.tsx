import PricingWorkspace from '../../../pricing/PricingWorkspace';
import DashboardShell, { dashboardPath } from '../../../../components/layout/DashboardShell';
import DocumentsWorkspace from '../../../documents/DocumentsWorkspace';
import TrackingWorkspace, { trackingViews } from '../../../tracking/TrackingWorkspace';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IUser } from '@my-project/shared';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../../lib/axios';
import { App } from 'antd';
import OrdersWorkspace from '../../../orders/OrdersWorkspace';
import { workspaces, roleGuides } from '../../../home/role-workspaces';
import NotificationsPanel, { type Notice } from '../../../notifications/NotificationsPanel';
export type DashboardProps={account:IUser;logout:()=>void};
export default function DashboardLayout({account,logout}:DashboardProps){
 const {message:messageApi}=App.useApp();
 const navigate=useNavigate();
 const leaveGuard=useRef<(()=>Promise<boolean>)|null>(null);
 const navigating=useRef(false);
 const registerLeaveGuard=useCallback((guard:(()=>Promise<boolean>)|null)=>{leaveGuard.current=guard;},[]);
 async function leave(work:()=>void){if(navigating.current)return;navigating.current=true;try{if(leaveGuard.current&&!await leaveGuard.current())return;work();}finally{navigating.current=false;}}
 const config=workspaces[account.role]||workspaces.ADMIN;
 const [params]=useSearchParams(),[notifications,setNotifications]=useState<Notice[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[markingId,setMarkingId]=useState<string|null>(null),[unread,setUnread]=useState(false);
 const navigation=[{id:'overview',title:'Tổng quan'},...config.areas,{id:'notifications',title:'Thông báo'},{id:'account',title:'Tài khoản'}];
 const requested=params.get('view')||'overview',view=navigation.some(n=>n.id===requested)?requested:'overview';
 const area=config.areas.find(a=>a.id===view),guide=roleGuides[account.role];
 const canOrder=['CUSTOMER','MANAGER'].includes(account.role);
 async function refresh(){setLoading(true);try{const {data}=await api.get<Notice[]>('/notifications');setNotifications(data);setError('');}catch{setError('Không tải được thông báo. Vui lòng thử lại.');}finally{setLoading(false);}}
 async function markRead(id:string){if(markingId)return;setMarkingId(id);try{await api.post('/notifications/'+id+'/read');setNotifications(items=>items.map(item=>item.id===id?{...item,is_read:1}:item));void messageApi.success({key:'notifications-feedback',content:'Đã đánh dấu thông báo là đã đọc.'});}catch{void messageApi.error({key:'notifications-feedback',content:'Chưa thể đánh dấu thông báo. Hãy thử lại.',duration:5});}finally{setMarkingId(null);}}
 useEffect(()=>{void refresh();},[account.id]);
 function go(next:string){if(next===view)return;void leave(()=>navigate(dashboardPath(next)));}
 return <DashboardShell account={account} logout={logout} activeView={view} beforeNavigate={leave}
   hasUnsavedChanges={()=>!!leaveGuard.current}>
 {view==='overview'&&<><section className="portal-welcome"><div><span className="portal-overline">SẴN SÀNG CHO HÀNH TRÌNH TIẾP THEO</span><h2>Xin chào, {account.fullName}.</h2><p>{config.intro}</p>{config.areas[0]&&<button onClick={()=>go(config.areas[0].id)}>Mở {config.areas[0].title.toLowerCase()} →</button>}</div><div className="portal-route-art" aria-hidden="true"><span>KHỞI HÀNH</span><div>◎ ─ ─ ◇ ─ ─ ◎</div><span>AN TOÀN ĐẾN ĐÍCH</span></div></section><section className="portal-panel" style={{marginTop:24}}><div className="portal-panel-heading"><h2>Công việc của bạn</h2><span className="portal-tag">{config.areas.length} khu vực</span></div><div className="portal-actions">{config.areas.map((a,i)=><button key={a.id} onClick={()=>go(a.id)}><span className="portal-action-index">0{i+1}</span><div><strong>{a.title}</strong><p>{a.description}</p></div><span>↗</span></button>)}</div></section>{guide&&<section className="portal-panel portal-guide"><h2>{guide.title}</h2><ol>{guide.steps.map((s,i)=><li key={s}><span>0{i+1}</span><p>{s}</p></li>)}</ol></section>}</>}
 {view==='pricing'&&account.role==='MANAGER'&&<PricingWorkspace onLeaveGuardChange={registerLeaveGuard}/>}
 {view==='orders'&&canOrder&&<div className="workspace portal-orders"><OrdersWorkspace onLeaveGuardChange={registerLeaveGuard} role={account.role} refreshNotifications={()=>void refresh()}/></div>}
 {['documents','submissions'].includes(view)&&['CUSTOMER','SPECIALIST','MANAGER'].includes(account.role)&&<DocumentsWorkspace role={account.role}/>} 
 {trackingViews(account.role).includes(view)&&<TrackingWorkspace role={account.role} view={view} onNavigate={go}/>}
 {area&&![...['orders','documents','submissions','pricing'],...trackingViews(account.role)].includes(area.id)&&<section className="portal-panel"><div className="portal-panel-heading"><h2>{area.title}</h2><span className="portal-tag">Chưa kết nối dữ liệu</span></div><p>{area.description}</p><div className="portal-table-wrap"><table><thead><tr>{area.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody><tr><td colSpan={area.columns.length}><div className="portal-empty"><h3>Chức năng thuộc Flow 2–4</h3><p>Dữ liệu sẽ hiển thị khi nghiệp vụ được kết nối. Hiện chưa thể cập nhật tại đây.</p><button onClick={()=>go('overview')}>Về tổng quan</button></div></td></tr></tbody></table></div></section>}
 {view==='notifications'&&<NotificationsPanel notifications={notifications} loading={loading} error={error} unreadOnly={unread} markingId={markingId} onUnreadChange={setUnread} onRefresh={()=>void refresh()} onMarkRead={id=>void markRead(id)}/>}
 {view==='account'&&<section className="portal-panel portal-account"><span className="portal-avatar">{account.fullName.slice(0,1)}</span><h2>{account.fullName}</h2><dl>{[['Email',account.email],['Số điện thoại',account.phone||'Chưa cập nhật'],['Địa chỉ nhà',account.address||'Chưa cập nhật'],['Vai trò',config.name]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
 </DashboardShell>;
}
