import {COUNTRY_CODES} from '@my-project/shared';
const names=new Intl.DisplayNames(['vi'],{type:'region'});
const countries=COUNTRY_CODES.map(code=>({code,name:names.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
export default function CountrySelect({id,value,onChange,error}:{id:string;value:string;onChange:(value:string)=>void;error?:string}){
 return <label htmlFor={id}>{id==='originCountry'?'Quốc gia / vùng lãnh thổ đi':'Quốc gia / vùng lãnh thổ đến'}<select id={id} value={value} onChange={e=>onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error?'error-'+id:undefined}><option value="">Chọn quốc gia / vùng lãnh thổ</option>{value&&!COUNTRY_CODES.includes(value)&&<option value={value}>Mã cũ: {value} — vui lòng chọn lại</option>}{countries.map(c=><option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select>{error&&<small className="error" id={'error-'+id} role="alert">{error}</small>}</label>;
}
