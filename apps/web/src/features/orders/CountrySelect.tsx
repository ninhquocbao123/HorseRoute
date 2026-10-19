import {COUNTRY_CODES} from '@my-project/shared';
import {Select} from 'antd';
const names=new Intl.DisplayNames(['vi'],{type:'region'});
const countries=COUNTRY_CODES.map(code=>({code,name:names.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
export default function CountrySelect({id,value,onChange,error,disabled=false}:{id:string;value:string;onChange:(value:string)=>void;error?:string;disabled?:boolean}){
 const options=[...(value&&!COUNTRY_CODES.includes(value)?[{value,label:`Mã cũ: ${value} — vui lòng chọn lại`}]:[]),...countries.map(country=>({value:country.code,label:`${country.name} (${country.code})`}))];
 return <label htmlFor={id}>{id==='originCountry'?'Quốc gia / vùng lãnh thổ đi':'Quốc gia / vùng lãnh thổ đến'}<Select id={id} showSearch optionFilterProp="label" placeholder="Chọn quốc gia / vùng lãnh thổ" value={value||undefined} options={options} disabled={disabled} status={error?'error':undefined} aria-invalid={!!error} aria-describedby={error?'error-'+id:undefined} onChange={onChange}/>{error&&<small className="error" id={'error-'+id} role="alert">{error}</small>}</label>;
}
