import CountrySelect from './CountrySelect';
import { WorkflowIntro, FlowSection } from '../workflow/WorkflowUI';
import SaveOrderDialog from './SaveOrderDialog';
import './order-list.css';
import DeleteOrderDialog from './DeleteOrderDialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, App, Button, Checkbox, DatePicker, Empty, Input, Pagination, Select, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../lib/axios';
import { OrderDetail, OrderDraft, OrderSummary, ReviewOptions, draftFrom, emptyDraft, emptyHorse, statuses } from './types';

type Errors = Record<string,string>;
const documentLabels:Record<string,string>={NOT_SUBMITTED:'Chưa nộp',SUBMITTED:'Đã nộp',VALID:'Hợp lệ',INVALID:'Không hợp lệ',EXPIRED:'Hết hạn'};
const historyLabels:Record<string,string>={CREATE:'Tạo đơn nháp',EDIT:'Sửa đơn',SUBMIT:'Gửi duyệt',REVIEW:'Phản hồi từ quản lý'};
const statusColors:Record<string,string>={DRAFT:'default',PENDING:'gold',NEED_INFO:'orange',APPROVED:'green',REJECTED:'red',PREPARING:'cyan',READY:'success',IN_TRANSIT:'blue',DELIVERED:'green',CANCELLED:'default'};
function StatusTag({status,label}:{status:string;label?:string}){return <Tag color={statusColors[status]}>{label||statuses[status]||status}</Tag>;}
export default function OrdersWorkspace({role, refreshNotifications,onLeaveGuardChange}:{role:string;refreshNotifications:()=>void;onLeaveGuardChange?:(guard:(()=>Promise<boolean>)|null)=>void}) {
  const customer=role==='CUSTOMER'; const manager=role==='MANAGER';
  const {message:messageApi}=App.useApp();
  const [showSaveDialog,setShowSaveDialog]=useState(false);
  const [showDeleteDialog,setShowDeleteDialog]=useState(false);
  async function removeDraft(){
    setShowDeleteDialog(false);
    await action(async()=>{
      if(detail)await api.delete('/orders/'+detail.id);
      setDetail(null);setDraft(emptyDraft());setEditing(false);setDirty(false);
      requestId.current=crypto.randomUUID();
      if(page>1)setPage(1);else await load();
      void messageApi.success({key:'orders-feedback',content:'Đã xóa đơn nháp.'});
    });
  }
  const saveAnswer=useRef<((save:boolean)=>void)|null>(null);
  function askToSave(){return new Promise<boolean>(resolve=>{saveAnswer.current=resolve;setShowSaveDialog(true);});}
  function answerSave(save:boolean){saveAnswer.current?.(save);saveAnswer.current=null;setShowSaveDialog(false);}
  useEffect(()=>()=>{saveAnswer.current?.(false);},[]);
  const [items,setItems]=useState<OrderSummary[]>([]), [page,setPage]=useState(1), [total,setTotal]=useState(0);
  const [group,setGroup]=useState('');
  const [filter,setFilter]=useState(''), [search,setSearch]=useState('');
  const [detail,setDetail]=useState<OrderDetail|null>(null), [draft,setDraft]=useState<OrderDraft>(emptyDraft);
  const [editing,setEditing]=useState(false), [dirty,setDirty]=useState(false), [busy,setBusy]=useState(false), [loading,setLoading]=useState(false);
  const [errors,setErrors]=useState<Errors>({});
  const [optionsLoaded,setOptionsLoaded]=useState(false);
  const [options,setOptions]=useState<ReviewOptions>({coordinators:[],rules:[]});
  const [coordinatorId,setCoordinatorId]=useState(''), [ruleIds,setRuleIds]=useState<string[]>([]), [reason,setReason]=useState('');
  const requestId=useRef(crypto.randomUUID()), saving=useRef(false), listVersion=useRef(0);
  const report=(e:unknown)=>{
    const body=isAxiosError(e)?e.response?.data:null;
    const content=Array.isArray(body?.message)?body.message.join(' · '):body?.message||'Không kết nối được máy chủ. Dữ liệu đang nhập được giữ lại; hãy thử lại.';
    void messageApi.error({key:'orders-feedback',content:String(content),duration:5});
    setErrors(body?.fields||{});
  };
  const load=useCallback(async()=>{
    const version=++listVersion.current;setLoading(true);
    try{const {data}=await api.get('/orders',{params:{page,limit:10,group:manager&&group?group:undefined,status:filter||undefined,search:search||undefined}});if(version===listVersion.current){setItems(data.items);setTotal(data.total);}}
    catch(e){if(version===listVersion.current)report(e);}
    finally{if(version===listVersion.current)setLoading(false);}
  },[page,filter,search,group,manager]);
  useEffect(()=>{void load();return()=>{listVersion.current++;};},[load]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(customer&&editing&&dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[customer,editing,dirty]);
  useEffect(()=>{
    onLeaveGuardChange?.(customer&&editing&&(dirty||busy)?async()=>{
      if(saving.current)return false;
      return askToSave();
    }:null);
    return()=>onLeaveGuardChange?.(null);
  });
  const leave=async()=>!customer||!dirty||await askToSave();
  async function action(work:()=>Promise<void>){if(saving.current)return;saving.current=true;setBusy(true);setErrors({});try{await work();}catch(e){report(e);}finally{saving.current=false;setBusy(false);}}
  async function read(id:string){const {data}=await api.get<OrderDetail>('/orders/'+id);setDetail(data);return data;}
  async function open(id:string){await read(id);setEditing(false);setDirty(false);setReason('');setCoordinatorId('');setRuleIds([]);setOptionsLoaded(false);setOptions({coordinators:[],rules:[]});if(manager){const {data}=await api.get<ReviewOptions>('/orders/'+id+'/review-options');setOptions(data);setOptionsLoaded(true);setRuleIds(data.rules.filter(r=>r.border_location_id===null).map(r=>String(r.id)));}}
  function startEdit(order:OrderDetail){setDraft(draftFrom(order));setEditing(true);setDirty(false);setErrors({});}
  async function persist(submit:boolean){
    const {data}=detail?await api.put('/orders/'+detail.id,draft):await api.post('/orders',{...draft,requestId:requestId.current});
    const saved=await read(data.id);setDirty(false);
    if(submit){
      try{await api.post('/orders/'+data.id+'/submit');}
      catch(e){setDraft(draftFrom(saved));setEditing(true);throw e;}
    }
    await open(data.id);await load();refreshNotifications();void messageApi.success({key:'orders-feedback',content:submit?'Đơn đã gửi đến quản lý.':'Đã lưu nháp. Bạn có thể tiếp tục chỉnh sửa sau.'});
  }
  function change(key:keyof Omit<OrderDraft,'horses'>,value:string){setDraft(d=>({...d,[key]:key.endsWith('Country')?value.toUpperCase():value}));setDirty(true);}
  function changeHorse(index:number,key:keyof OrderDraft['horses'][number],value:string){setDraft(d=>({...d,horses:d.horses.map((horse,current)=>current===index?{...horse,[key]:value}:horse)}));setDirty(true);}
  function error(path:string){return errors[path]?<small id={'error-'+path} className="error" role="alert">{errors[path]}</small>:null;}
  function input(key:keyof Omit<OrderDraft,'horses'>,label:string,max=255){return <label htmlFor={key}>{label}<Input id={key} maxLength={max} value={draft[key]} disabled={busy} status={errors[key]?'error':undefined} aria-invalid={!!errors[key]} aria-describedby={errors[key]?'error-'+key:undefined} onChange={e=>change(key,e.target.value)}/>{error(key)}</label>;}
  async function review(decision:string){await api.post('/orders/'+detail!.id+'/review',{decision,reason,...(decision==='APPROVED'?{coordinatorId,ruleIds}:{})});await open(detail!.id);await load();refreshNotifications();void messageApi.success({key:'orders-feedback',content:'Đã ghi nhận kết quả duyệt và gửi thông báo cho khách hàng.'});}
  const deleteButton=customer&&(!detail||detail.status==='DRAFT')?<Button danger disabled={busy} onClick={()=>setShowDeleteDialog(true)}>Xóa đơn</Button>:null;
  return <section className="flow-workspace flow-orders" aria-label="Đơn vận chuyển"><WorkflowIntro number="01" title={customer?'Bắt đầu một hành trình mới':'Tiếp nhận & xét duyệt yêu cầu'} description={customer?'Chuẩn bị thông tin chuyến đi, thêm ngựa và gửi yêu cầu đến đội ngũ vận chuyển.':'Kiểm tra thông tin khách hàng, lựa chọn quy định và phản hồi ngay trên từng đơn.'} steps={['Tạo yêu cầu','Kiểm tra thông tin','Xét duyệt đơn']}/>
    {showSaveDialog&&<SaveOrderDialog onAnswer={answerSave}/>}
    {showDeleteDialog&&<DeleteOrderDialog onClose={()=>setShowDeleteDialog(false)} onDelete={()=>void removeDraft()}/>}
    <div className="flow-context-bar"><div><strong>{customer?'Không gian riêng của bạn':'Hàng đợi tiếp nhận'}</strong><p>{customer?'Chỉ bạn thấy đơn của mình. Bản nháp chưa được gửi cho Manager.':'Chỉ hiển thị đơn đã gửi. Đơn tạo trước được xếp trước trong từng nhóm.'}</p></div><span className="flow-sort-label">Cũ nhất → Mới nhất</span></div>
    {manager&&<nav className="flow-queue-tabs" aria-label="Nhóm đơn vận chuyển">{[['','Tất cả đơn đã gửi','Theo dõi toàn bộ yêu cầu'],['pending','Chưa duyệt','Chờ duyệt / bổ sung thông tin'],['approved','Đã duyệt','Theo dõi tiến độ vận chuyển'],['documents','Cần bổ sung giấy tờ','Đã duyệt · thiếu, lỗi hoặc hết hạn'],['closed','Từ chối / Đã hủy','Các yêu cầu đã dừng']].map(([value,label,hint])=><button key={value} aria-pressed={group===value} disabled={busy} onClick={()=>{setGroup(value);setFilter('');setPage(1);setDetail(null);}}><strong>{label}</strong><small>{hint}</small></button>)}</nav>}
    <div className={'workspace-grid master-detail '+(detail||editing?'has-detail':'list-only')}><section className="card flow-list"><div className="header"><h2>{customer?'Đơn của tôi':'Duyệt yêu cầu'}</h2>{customer&&<Button type="primary" disabled={busy} onClick={async()=>{if(!await leave())return;setDetail(null);setDraft(emptyDraft());setEditing(true);setDirty(false);setErrors({});requestId.current=crypto.randomUUID();}}>Tạo đơn +</Button>}</div>
      <p className="flow-list-caption">{total} yêu cầu trong danh sách</p><div className="order-list-filters"><label htmlFor="order-search">Tìm mã đơn<Input id="order-search" allowClear placeholder="VD: WDP-2026…" value={search} maxLength={50} disabled={busy} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
      <label htmlFor="order-status">Trạng thái<Select id="order-status" value={filter} disabled={busy} options={[{value:'',label:'Tất cả trạng thái'},...Object.entries(statuses).filter(([value])=>customer||value!=='DRAFT').map(([value,label])=>({value,label}))]} onChange={value=>{setFilter(value);setPage(1);}}/></label>
      <Button disabled={busy} loading={loading} onClick={()=>void load()}>Làm mới</Button></div>
      <div className="order-list-scroll" role="region" aria-label="Danh sách đơn vận chuyển" tabIndex={0} aria-busy={loading}>
      {loading?<div className="order-list-state"><Spin tip="Đang tải danh sách…"/></div>:items.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn phù hợp"/>:items.map(o=><button className={'order-row '+(detail?.id===o.id?'selected':'')} key={o.id} disabled={busy} onClick={async()=>{if(await leave())void action(()=>open(o.id));}}><strong>{o.order_code}</strong>{manager&&<span>{o.customer_name}</span>}<span>{o.origin_country||'Chưa chọn'} → {o.destination_country||'Chưa chọn'}</span>{o.created_at&&<small className="flow-created">Tạo ngày {new Date(o.created_at).toLocaleDateString('vi-VN')}</small>}<StatusTag status={o.status}/></button>)}
      </div><Pagination className="pagination" current={page} pageSize={10} total={total} disabled={busy||loading} showSizeChanger={false} showTotal={count=>`${count} đơn`} onChange={setPage}/>
    </section><section className="card order-content" hidden={!detail&&!editing}>
      <Button type="text" className="back-to-list" disabled={busy} onClick={async()=>{if(await leave()){setDetail(null);setEditing(false);setDirty(false);}}}>← Quay lại danh sách</Button>
      {editing?<form noValidate onSubmit={e=>{e.preventDefault();void action(()=>persist(true));}}><div className="flow-editor-title"><div><span className="flow-kicker">YÊU CẦU VẬN CHUYỂN</span><h2>{detail?'Chỉnh sửa yêu cầu':'Yêu cầu vận chuyển mới'}</h2></div><StatusTag status={detail?.status==='NEED_INFO'?'NEED_INFO':'DRAFT'} label={detail?.status==='NEED_INFO'?'Đang bổ sung':'Bản nháp riêng tư'}/></div><p className="form-hint">Bạn có thể lưu nháp khi chưa điền đủ. Khi gửi duyệt, cần địa chỉ, quốc gia, ngày khởi hành và ít nhất một ngựa có tên, định danh.</p><fieldset disabled={busy}><FlowSection number="01" title="Thông tin hành trình" description="Điểm đi, điểm đến và thời gian bạn mong muốn."/><div className="form-grid flow-route-fields">{input('originAddress','Địa chỉ đi')}{input('destinationAddress','Địa chỉ đến')}<CountrySelect id="originCountry" value={draft.originCountry} disabled={busy} onChange={value=>change('originCountry',value)} error={errors.originCountry}/><CountrySelect id="destinationCountry" value={draft.destinationCountry} disabled={busy} onChange={value=>change('destinationCountry',value)} error={errors.destinationCountry}/><label htmlFor="desiredDepartureDate">Ngày khởi hành mong muốn<DatePicker id="desiredDepartureDate" value={draft.desiredDepartureDate?dayjs(draft.desiredDepartureDate):null} format="DD/MM/YYYY" disabled={busy} status={errors.desiredDepartureDate?'error':undefined} onChange={date=>change('desiredDepartureDate',date?date.format('YYYY-MM-DD'):'')}/>{error('desiredDepartureDate')}</label><label htmlFor="specialRequirements">Yêu cầu đặc biệt<Input.TextArea id="specialRequirements" rows={4} maxLength={5000} showCount value={draft.specialRequirements} disabled={busy} status={errors.specialRequirements?'error':undefined} onChange={e=>change('specialRequirements',e.target.value)}/>{error('specialRequirements')}</label></div>
        <p className="form-hint">Có thể chọn mọi quốc gia / vùng lãnh thổ, kể cả tuyến nội địa. Tuyến chưa có quy định vẫn được gửi yêu cầu; cần bổ sung quy định và giấy tờ phù hợp trước khi duyệt.</p><FlowSection number="02" title={`Danh sách ngựa (${draft.horses.length})`} description="Mỗi ngựa cần tên và định danh / hộ chiếu riêng khi gửi duyệt."/>{error('horses')}{draft.horses.map((horse,index)=><fieldset className="horse-form" key={horse.id||index}><legend>Ngựa {index+1}</legend><div className="form-grid">{(['name','passportNo','breed','birthDate','sex','coatColor','note'] as const).map((key,i)=>{const path=`horses.${index}.${key}`;const label=['Tên ngựa','Định danh / hộ chiếu','Giống ngựa','Ngày sinh','Giới tính','Màu lông','Ghi chú'][i];const maxLength=key==='name'?100:key==='note'?255:key==='coatColor'?30:50;return <label htmlFor={path} key={key}>{label}{key==='birthDate'?<DatePicker id={path} value={horse[key]?dayjs(horse[key]):null} format="DD/MM/YYYY" disabled={busy} status={errors[path]?'error':undefined} onChange={date=>changeHorse(index,key,date?date.format('YYYY-MM-DD'):'')}/>:key==='sex'?<Select id={path} placeholder="Chọn giới tính" value={horse[key]||undefined} disabled={busy} status={errors[path]?'error':undefined} options={[{value:'Đực',label:'Đực'},{value:'Cái',label:'Cái'}]} onChange={value=>changeHorse(index,key,value)}/>:key==='note'?<Input.TextArea id={path} rows={3} maxLength={maxLength} value={horse[key]} disabled={busy} status={errors[path]?'error':undefined} onChange={e=>changeHorse(index,key,e.target.value)}/>:<Input id={path} maxLength={maxLength} value={horse[key]} disabled={busy} status={errors[path]?'error':undefined} onChange={e=>changeHorse(index,key,e.target.value)}/>} {error(path)}</label>;})}</div><Button danger onClick={()=>{setDraft(d=>({...d,horses:d.horses.filter((_,i)=>i!==index)}));setDirty(true);}}>Bỏ ngựa {index+1}</Button></fieldset>)}
        <Button disabled={draft.horses.length>=50||busy} onClick={()=>{setDraft(d=>({...d,horses:[...d.horses,emptyHorse()]}));setDirty(true);}}>+ Thêm ngựa</Button><div className="form-actions flow-form-footer">{deleteButton}<Button onClick={()=>void action(()=>persist(false))}>Lưu nháp</Button><Button type="primary" htmlType="submit" loading={busy}>Lưu và gửi duyệt</Button><Button onClick={async()=>{if(await leave()){setDetail(null);setEditing(false);setDirty(false);}}}>Đóng</Button></div></fieldset></form>
      :detail?<><div className="header"><h2>{detail.order_code}</h2><StatusTag status={detail.status}/></div><p className="flow-customer-line"><strong>Khách hàng:</strong> {detail.customer.full_name} · {detail.customer.email}{detail.customer.phone&&` · ${detail.customer.phone}`}</p><p className="flow-route-summary"><strong>Đi:</strong> {detail.origin_address||'Chưa nhập'} ({detail.origin_country||'—'})<br/><strong>Đến:</strong> {detail.destination_address||'Chưa nhập'} ({detail.destination_country||'—'})<br/><strong>Khởi hành:</strong> {detail.desired_departure_date?.slice(0,10)||'Chưa chọn'}</p><p className="preserve-text">{detail.special_requirements}</p>{detail.manager_note&&<Alert type="info" showIcon message="Phản hồi quản lý" description={<span className="preserve-text">{detail.manager_note}</span>}/>}
        <FlowSection number="01" title="Ngựa trong yêu cầu"/>{detail.draft?<p>{detail.draft.horses.length} ngựa trong bản nháp. Chọn Chỉnh sửa để xem và hoàn thiện.</p>:detail.horses.map(h=><article className="horse-summary" key={h.id}><strong>{h.name}</strong><p>{h.passport_no} · {h.breed||'Chưa có giống'} · {h.sex||'Chưa có giới tính'}{h.birth_date&&` · Sinh ${h.birth_date.slice(0,10)}`}{h.coat_color&&` · ${h.coat_color}`}</p>{h.note&&<p>{h.note}</p>}</article>)}
        <FlowSection number="02" title="Giấy tờ đã ghi nhận"/>{detail.documents.length?<ul>{detail.documents.map(d=><li key={d.id}>{d.horse_name} · {d.document_name}: {documentLabels[d.status]||d.status}</li>)}</ul>:<p>Chưa có giấy tờ. Checklist được khởi tạo khi duyệt đơn.</p>}
        {customer&&['DRAFT','NEED_INFO'].includes(detail.status)&&<div className="form-actions"><Button type="primary" disabled={busy} onClick={()=>startEdit(detail)}>Chỉnh sửa và gửi duyệt</Button>{deleteButton}</div>}
        {manager&&detail.status==='PENDING'&&<form noValidate onSubmit={e=>{e.preventDefault();void action(()=>review('APPROVED'));}}><fieldset disabled={busy}><FlowSection number="03" title="Kết quả xét duyệt" description="Chọn người phụ trách và quy định áp dụng trước khi duyệt."/><label htmlFor="coordinator">Điều phối viên phụ trách<Select id="coordinator" showSearch optionFilterProp="label" placeholder="Chọn điều phối viên" value={coordinatorId||undefined} disabled={busy} status={errors.coordinatorId?'error':undefined} options={options.coordinators.map(coordinator=>({value:coordinator.id,label:coordinator.full_name}))} onChange={setCoordinatorId}/>{error('coordinatorId')}</label><fieldset className="rule-list review-rule-picker"><legend>Chọn quy định áp dụng *</legend><p className="rule-route">Tuyến vận chuyển: <strong>{detail.origin_country} → {detail.destination_country}</strong></p><p className="form-hint">Chọn đầy đủ quy định chung và quy định của một cửa khẩu phù hợp. Các quy định này dùng để tạo checklist giấy tờ cho ngựa.</p>{!optionsLoaded?<div role="status"><p>Chưa tải được danh mục quy định.</p><Button onClick={()=>void action(()=>open(detail.id))}>Tải lại danh mục</Button></div>:options.rules.length?<><p>Đã chọn <strong>{ruleIds.length}/{options.rules.length}</strong> quy định</p>{options.rules.map(r=><Checkbox className="review-rule-option" key={r.id} checked={ruleIds.includes(String(r.id))} disabled={busy} onChange={e=>setRuleIds(ids=>e.target.checked?[...ids,String(r.id)]:ids.filter(x=>x!==String(r.id)))}><span className="review-rule-copy"><strong>Quy định #{r.id} · {r.authority_name||'Chưa có cơ quan'}</strong><small>{r.border_name||'Quy định chung — bắt buộc chọn'}</small></span></Checkbox>)}</>:<Alert type="warning" showIcon message={`Chưa có quy định cho tuyến ${detail.origin_country} → ${detail.destination_country}`} description="Cần bổ sung danh mục quy định kiểm dịch cho đúng tuyến trước khi duyệt đơn. Không thể chọn quy định của tuyến khác."/>}{error('ruleIds')}</fieldset><label htmlFor="reason">Nội dung phản hồi<Input.TextArea id="reason" rows={4} maxLength={2000} showCount value={reason} disabled={busy} status={errors.reason?'error':undefined} onChange={e=>setReason(e.target.value)} placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung"/>{error('reason')}</label><div className="form-actions"><Button type="primary" htmlType="submit" loading={busy} disabled={!optionsLoaded||!ruleIds.length||!coordinatorId}>Duyệt đơn</Button><Button disabled={busy} onClick={()=>void action(()=>review('NEED_INFO'))}>Yêu cầu bổ sung</Button><Button danger disabled={busy} onClick={()=>void action(()=>review('REJECTED'))}>Từ chối</Button></div></fieldset></form>}
        <details className="order-history"><summary>Lịch sử xử lý</summary>{detail.history.length?detail.history.map(h=><p key={h.id}><strong>{historyLabels[h.action]||h.action}</strong> · {h.actor_name} · {new Date(h.occurred_at).toLocaleString('vi-VN')}<br/>{h.reason}</p>):<p>Chưa có lịch sử xử lý được ghi nhận.</p>}</details>
      </>:<div className="workspace-empty flow-empty"><div className="flow-empty-symbol" aria-hidden="true">↗</div><p className="eyebrow">FLOW 1 · YÊU CẦU VẬN CHUYỂN</p><h2>Mỗi hành trình, một sự an tâm.</h2><p>{customer?'Tạo bản nháp hoặc chọn đơn để tiếp tục hoàn thiện.':'Chọn đơn Chờ duyệt để kiểm tra thông tin và phản hồi khách hàng.'}</p></div>}
    </section></div>
  </section>;
}


