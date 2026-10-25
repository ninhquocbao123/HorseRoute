import {COUNTRY_CODES} from '@my-project/shared';
import {Select} from 'antd';
const names=new Intl.DisplayNames(['vi'],{type:'region'});
const countries=COUNTRY_CODES.map(code=>({code,name:names.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
export const countryName=(code:string)=>names.of(code)||code;
/** `label={null}` renders only the select, for use inside an antd Form.Item that owns the label. */
export default function CountrySelect({id,value,onChange,error,disabled=false,label,allowClear=false,placeholder='Chọn quốc gia / vùng lãnh thổ'}:{id:string;value:string|undefined;onChange:(value:string)=>void;error?:string;disabled?:boolean;label?:string|null;allowClear?:boolean;placeholder?:string}){
 const options=[...(value&&!COUNTRY_CODES.includes(value)?[{value,label:`Mã cũ: ${value} — vui lòng chọn lại`}]:[]),...countries.map(country=>({value:country.code,label:`${country.name} (${country.code})`}))];
 const select=<Select id={id} showSearch optionFilterProp="label" placeholder={placeholder} value={value||undefined} options={options} disabled={disabled} allowClear={allowClear} status={error?'error':undefined} aria-invalid={!!error} aria-describedby={error?'error-'+id:undefined} onChange={next=>onChange(next??'')}/>;
 if(label===null)return select;
 return <label htmlFor={id}>{label??(id==='originCountry'?'Quốc gia / vùng lãnh thổ đi':'Quốc gia / vùng lãnh thổ đến')}{select}{error&&<small className="error" id={'error-'+id} role="alert">{error}</small>}</label>;
}
