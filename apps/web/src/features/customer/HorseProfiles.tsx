import {useFeedback} from '../../components/useFeedback';
import { useRef, useState, type ReactNode } from 'react';
import { App, Alert, Button, Empty, Modal } from 'antd';
import { CheckCircleOutlined, FileTextOutlined, PlusOutlined, ArrowRightOutlined, ArrowLeftOutlined, UploadOutlined, EyeOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { isAxiosError } from 'axios';
import { api } from '../../lib/axios';
import type { Profile } from './CustomerJourney';
import './horse-profiles.css';

type DocumentType = {id:string;name:string;description:string};
type PendingFile = {file:File;kind:'PHOTO'|'DOCUMENT';slot:string};
type Props = {profiles:Profile[];types:DocumentType[];ownerName:string;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void;showFile:(path:string,name:string)=>Promise<void>;preview:(file:File)=>void};
const blank = (ownerName:string):Profile => ({name:'',passportNo:'',breed:'',birthDate:'',sex:'',coatColor:'',microchip:'',weightKg:null,heightCm:null,ownerName,feed:'',note:'',documentNote:'',files:[],documents:[]});
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="hp-field"><span>{label}</span>{children}</label>; }
function age(date:string) {
  if (!date) return 'Chưa rõ tuổi';
  const born = new Date(date), now = new Date();
  const years = now.getFullYear()-born.getFullYear()-(now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate())?1:0);
  return years<1?'Dưới 1 tuổi':`${years} tuổi`;
}

export default function HorseProfiles({profiles,types,ownerName,reload,onDirty,showFile,preview}:Props) {
  const {message,modal} = useFeedback();
  const [editing,setEditing] = useState<Profile|null>(null);
  const [step,setStep] = useState(0), [filter,setFilter] = useState('all');
  const [pending,setPending] = useState<Record<string,PendingFile>>({});
  const [busy,setBusy] = useState(false), [dirty,setDirty] = useState(false), [saveError,setSaveError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  // Use catalog IDs instead of assuming document IDs are identical across databases.
  const coreTypes = [/hộ chiếu|passport/i,/tiêm|vaccin/i,/eia|coggins/i].flatMap(pattern=>{const type=types.find(t=>pattern.test(t.name));return type?[type]:[];});
  const fileFor = (p:Profile,id:string) => p.files.find(f=>f.kind==='DOCUMENT'&&String(f.slot)===String(id));
  const complete = (p:Profile) => coreTypes.length>=3&&coreTypes.every(t=>!!fileFor(p,t.id));
  const count = (p:Profile) => coreTypes.filter(t=>fileFor(p,t.id)||pending['DOCUMENT:'+t.id]).length;
  const ready = profiles.filter(complete).length;
  const visible = profiles.filter(p=>filter==='all'||(filter==='complete'?complete(p):!complete(p)));
  const markDirty = () => {setDirty(true);onDirty(true);};
  const change = (patch:Partial<Profile>) => {setEditing(p=>p?{...p,...patch}:p);markDirty();};
  function open(p?:Profile,at=0) {setEditing(p?{...p}:blank(ownerName));setStep(at);setPending({});setDirty(false);setSaveError('');}
  function close() {
    if (busy) return;
    const discard = () => {setEditing(null);setPending({});setDirty(false);onDirty(false);};
    if (dirty) modal.confirm({title:'Bỏ thay đổi chưa lưu?',content:'Thông tin và tệp vừa chọn chưa được lưu vào hồ sơ.',okText:'Bỏ thay đổi',cancelText:'Tiếp tục chỉnh sửa',onOk:discard});
    else discard();
  }
  function next() {if(form.current?.reportValidity())setStep(1);}
  function choose(file:File,kind:PendingFile['kind'],slot:string) {
    if(file.size>5*1024*1024) {void message.error('Mỗi tệp tối đa 5 MB.');return;}
    if(!(kind==='PHOTO'?['image/png','image/jpeg']:['application/pdf','image/png','image/jpeg']).includes(file.type)) {void message.error('Chọn tệp '+(kind==='PHOTO'?'JPG hoặc PNG.':'PDF, JPG hoặc PNG.'));return;}
    setPending(p=>({...p,[kind+':'+slot]:{file,kind,slot}}));markDirty();
  }
  async function save() {
    if(!editing||busy)return;
    if(!form.current?.checkValidity()){setStep(0);requestAnimationFrame(()=>form.current?.reportValidity());return;}
    setBusy(true);setSaveError('');
    let profileSaved=false;
    try {
      const {id,files,documents:docs,...payload}=editing;
      const r=await(id?api.put('/customer/profiles/'+id,payload):api.post('/customer/profiles',payload));
      const savedId=String(r.data.id),revision=(editing.revision||0)+1;
      profileSaved=true;
      setEditing(p=>p?{...p,id:savedId,revision}:p);
      // Remove each successful upload from the queue so retrying cannot duplicate it.
      for(const [key,item] of Object.entries(pending)) {
        const body=new FormData();body.append('file',item.file);body.append('kind',item.kind);body.append('slot',item.slot);
        const uploaded=await api.post(`/customer/profiles/${savedId}/files`,body);
        setEditing(p=>p?{...p,files:[{id:String(uploaded.data.id),kind:item.kind,slot:item.slot,original_name:item.file.name},...p.files]}:p);
        setPending(p=>{const next={...p};delete next[key];return next;});
      }
      await reload();setEditing(null);setPending({});setDirty(false);onDirty(false);void message.success('Đã lưu hồ sơ ngựa.');
    } catch(e) {
      const reason=isAxiosError(e)?String(e.response?.data?.message||'Không kết nối được máy chủ.'):'Không lưu được hồ sơ.';
      setSaveError((profileSaved?'Thông tin ngựa đã lưu. Một số tệp chưa tải thành công; bấm lưu để thử lại. ':'')+reason);
      if(profileSaved)await reload();
    } finally {setBusy(false);}
  }
  function uploadRow(kind:PendingFile['kind'],slot:string,label:string) {
    const queued=pending[kind+':'+slot];
    const stored=editing?.files.find(f=>f.kind===kind&&String(f.slot)===slot);
    const name=queued?.file.name||stored?.original_name;
    return <section className="hp-document-row" key={kind+slot}><h4>{label}</h4><div className={'hp-upload '+(name?'has-file':'')}>
      <span className="hp-file-icon">{name?<CheckCircleOutlined/>:<FileTextOutlined/>}</span>
      <div className="hp-file-info"><b>{name||'Chưa chọn tệp'}</b><small>{queued?'Chưa lưu · ':''}PDF, JPG, PNG · tối đa 5 MB</small></div>
      <div className="hp-file-actions">{name&&<Button aria-label={'Xem '+label} icon={<EyeOutlined/>} onClick={()=>queued?preview(queued.file):void showFile('/customer/files/'+stored!.id,name)}>Xem</Button>}
        <label className="hp-upload-button"><UploadOutlined/>{name?'Đổi tệp':'Chọn tệp'}<input aria-label={'Tải '+label} type="file" disabled={busy} accept={kind==='PHOTO'?'image/jpeg,image/png':'application/pdf,image/jpeg,image/png'} onChange={e=>{const f=e.target.files?.[0];if(f)choose(f,kind,slot);e.target.value='';}}/></label>
        {queued&&<Button type="text" aria-label={'Bỏ tệp vừa chọn '+label} icon={<CloseOutlined/>} onClick={()=>{setPending(p=>{const n={...p};delete n[kind+':'+slot];return n;});markDirty();}}/>}
      </div>
    </div></section>;
  }
  return <section className="customer-card cj-sheet hp-workspace">
    <div className="customer-heading"><div><h2>Hồ sơ ngựa</h2><p>Quản lý thông tin ngựa và giấy tờ trước khi đặt chuyến.</p></div><Button className="customer-gold" icon={<PlusOutlined/>} onClick={()=>open()}>Thêm ngựa mới</Button></div>
    <div className="hp-stats">{[[profiles.length,'Ngựa trong hồ sơ'],[ready,'Đã đủ giấy tờ cơ bản'],[profiles.length-ready,'Cần bổ sung giấy tờ']].map(([n,label],i)=><div key={label} className={'hp-stat hp-stat-'+i}><span>{i===0?<FileTextOutlined/>:i===1?<CheckCircleOutlined/>:<UploadOutlined/>}</span><div><strong>{n}</strong><small>{label}</small></div></div>)}</div>
    <div className="hp-toolbar"><div className="hp-filters">{[['all','Tất cả'],['complete','Đủ giấy tờ'],['missing','Cần bổ sung']].map(([key,label])=><button key={key} aria-pressed={filter===key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div><span>{visible.length} hồ sơ</span></div>
    <div className="customer-horse-grid hp-cards">{visible.map(p=><article key={p.id}>
      <div className="hp-card-top"><h3>{p.name}</h3><span className={'hp-badge '+(complete(p)?'complete':'missing')}>{complete(p)?'Đủ giấy tờ':'Cần bổ sung'}</span></div>
      <p className="hp-chip">Microchip · {p.microchip||'Chưa cập nhật'}</p>
      <dl className="hp-specs">{[['Giống',p.breed],['Giới tính',p.sex],['Độ tuổi',age(p.birthDate)],['Màu lông',p.coatColor],['Cân nặng',p.weightKg==null?'':p.weightKg+' kg'],['Chiều cao',p.heightCm==null?'':p.heightCm+' cm']].map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v||'Chưa cập nhật'}</dd></div>)}</dl>
      <div className="hp-card-docs"><div><b>Giấy tờ cơ bản</b><span>{coreTypes.filter(t=>fileFor(p,t.id)).length}/{coreTypes.length}</span></div>{coreTypes.map(t=>{const file=fileFor(p,t.id);return <button key={t.id} disabled={!file} onClick={()=>file&&void showFile('/customer/files/'+file.id,file.original_name)}><span>{file?<CheckCircleOutlined/>:<FileTextOutlined/>} {/hộ chiếu|passport/i.test(t.name)?'Hộ chiếu':/tiêm|vaccin/i.test(t.name)?'Sổ tiêm':'Xét nghiệm'}</span><small>{file?'Đã nộp ↗':'Còn thiếu'}</small></button>;})}</div>
      <div className="hp-card-footer"><Button icon={<EditOutlined/>} onClick={()=>open(p)}>Sửa hồ sơ</Button><Button type="primary" onClick={()=>open(p,1)}>Giấy tờ</Button></div>
    </article>)}</div>
    {!visible.length&&<div className="hp-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={profiles.length?'Không có hồ sơ phù hợp bộ lọc.':'Chưa có ngựa trong hồ sơ của bạn.'}/>{!profiles.length&&<Button onClick={()=>open()} icon={<PlusOutlined/>}>Thêm ngựa đầu tiên</Button>}</div>}
    <p className="hp-footnote">Đủ giấy tờ cơ bản là đã tải đủ tệp.</p>
    <Modal open={!!editing} title={null} footer={null} width={1040} className="hp-modal" onCancel={close} maskClosable={false} closable={!busy} keyboard={!busy} destroyOnHidden>
      {editing&&<><header className="hp-modal-header"><h2>{editing.id?'Chỉnh sửa hồ sơ ngựa':'Thêm ngựa vào hồ sơ'}</h2><p>Khai báo một lần, sử dụng cho các lần đặt chuyến sau.</p></header>
      <div className="hp-steps" aria-label="Các bước tạo hồ sơ"><button aria-current={step===0?'step':undefined} className={step===0?'active':''} disabled={busy} onClick={()=>setStep(0)}><EditOutlined/><span>Nhận dạng & đặc điểm</span></button><button aria-current={step===1?'step':undefined} className={step===1?'active':''} disabled={busy} onClick={next}><FileTextOutlined/><span>Giấy tờ & kiểm dịch</span><small>{count(editing)}/{coreTypes.length} giấy</small></button></div>
      <form ref={form} onSubmit={e=>{e.preventDefault();if(step===0)next();else void save();}}>
        <fieldset disabled={busy} className="hp-body">
          {saveError&&<Alert type="error" showIcon title={saveError}/>}
          <fieldset className="hp-form-section" hidden={step!==0}><legend>Nhận dạng</legend>
            
            <div className="hp-form-grid">
              <Field label="Tên ngựa *"><input required maxLength={100} value={editing.name} placeholder="Ví dụ: Silver Moon" onChange={e=>change({name:e.target.value})}/></Field>
              <Field label="Mã microchip *"><input required maxLength={50} value={editing.microchip} placeholder="Ví dụ: VN-985211" onChange={e=>change({microchip:e.target.value})}/></Field>
              <Field label="Giống ngựa *"><input required list="hp-breeds" maxLength={50} value={editing.breed} placeholder="Chọn hoặc nhập giống ngựa" onChange={e=>change({breed:e.target.value})}/><datalist id="hp-breeds">{['Thoroughbred','Arabian','Quarter Horse','Warmblood','Appaloosa','Ngựa Việt Nam'].map(v=><option key={v} value={v}/>)}</datalist></Field>
              <Field label="Giới tính"><select value={editing.sex} onChange={e=>change({sex:e.target.value})}><option value="">Chưa xác định</option><option>Đực</option><option>Cái</option></select></Field>
              <Field label="Ngày sinh *"><input required type="date" max={new Date().toLocaleDateString('en-CA')} value={editing.birthDate} onChange={e=>change({birthDate:e.target.value})}/></Field>
              <Field label="Màu lông *"><input required maxLength={30} value={editing.coatColor} placeholder="Ví dụ: Nâu đỏ" onChange={e=>change({coatColor:e.target.value})}/></Field>
              <Field label="Cân nặng (kg)"><input type="number" min={0} max={2000} value={editing.weightKg??''} onChange={e=>change({weightKg:e.target.value?Number(e.target.value):null})}/></Field>
              <Field label="Chiều cao (cm)"><input type="number" min={0} max={300} value={editing.heightCm??''} onChange={e=>change({heightCm:e.target.value?Number(e.target.value):null})}/></Field>
              <Field label="Số hộ chiếu (FEI / quốc gia)"><input maxLength={50} readOnly={!!editing.id&&!!profiles.find(p=>p.id===editing.id)?.passportNo} value={editing.passportNo} onChange={e=>change({passportNo:e.target.value})}/></Field>
              <Field label="Chủ sở hữu"><input maxLength={120} value={editing.ownerName} onChange={e=>change({ownerName:e.target.value})}/></Field>
            </div>
            <Field label="Đặc điểm nhận dạng & lưu ý sức khỏe"><textarea rows={2} maxLength={255} value={editing.note} placeholder="Đốm trắng ở trán, tính cách, dị ứng hoặc lưu ý chăm sóc…" onChange={e=>change({note:e.target.value})}/></Field>
          </fieldset>
          <fieldset className="hp-form-section" hidden={step!==1}><legend>Giấy tờ sức khỏe & kiểm dịch</legend><p className="hp-help">Có thể lưu hồ sơ và bổ sung giấy tờ sau.</p>
            {!coreTypes.length&&<Alert type="warning" title="Chưa tải được danh mục giấy tờ. Hãy đóng và thử tải lại danh sách hồ sơ."/>}
            {coreTypes.map(t=>uploadRow('DOCUMENT',String(t.id),t.name))}
            
            <Field label="Ghi chú cho thẩm định viên"><textarea rows={3} maxLength={1000} value={editing.documentNote} onChange={e=>change({documentNote:e.target.value})} placeholder="Thông tin về bản gốc và các lưu ý khác…"/></Field>
          </fieldset>
        </fieldset>
        <footer className="hp-modal-footer"><Button disabled={busy} onClick={close}>Hủy</Button><div>{step===1?<Button disabled={busy} icon={<ArrowLeftOutlined/>} onClick={()=>setStep(0)}>Thông tin ngựa</Button>:<Button disabled={busy} onClick={next}>Tiếp tục: Giấy tờ <ArrowRightOutlined/></Button>}<Button type="primary" loading={busy} onClick={()=>void save()}>Lưu vào hồ sơ</Button></div></footer>
      </form></>}
    </Modal>
  </section>;
}
