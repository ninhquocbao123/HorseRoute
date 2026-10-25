import { Button, Select } from 'antd';
import { SwapOutlined, CalendarOutlined, EnvironmentOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import './booking-contacts.css';
import vietnamLocations from './vietnam-locations.json';
import chinaLocations from './china-locations.json';
import thailandLocations from './thailand-locations.json';
import CountryFlag from './CountryFlag';
const locations:Record<string,{name:string;wards:string[]}[]>={VN:vietnamLocations,CN:chinaLocations,TH:thailandLocations};

export type BookingContact = {name:string;phone:string;address:string;city:string;ward:string;identityNumber:string;country:string};
type Props = {
  date:string;onDate:(date:string)=>void;sender:BookingContact;recipient:BookingContact;
  onContact:(key:'sender'|'recipient',patch:Partial<BookingContact>)=>void;
  account:{fullName:string;phone?:string|null;address?:string|null};
  international:boolean;countries:string[][];onRoute:(from:string,to:string)=>void;
};
const Field=({label,children}:{label:string;children:ReactNode})=><label className="bc-field"><span>{label}</span>{children}</label>;
export const contactAddress=(contact:BookingContact)=>[contact.address,contact.ward,contact.city].filter(Boolean).join(', ');

export default function BookingContacts({date,onDate,sender,recipient,onContact,account,international,countries,onRoute}:Props){
  const earliest=new Date().toISOString().slice(0,10);
  const countryLabel=(code:string)=><span className="bc-country-label"><CountryFlag country={code}/>{countries.find(c=>c[0]===code)?.[1]||code}</span>;
  const countryControl=(key:'sender'|'recipient')=>{
    const contact=key==='sender'?sender:recipient;
    const title=key==='sender'?'Nước khởi hành *':'Nước đến *';
    return <Field label={title}>{contact.country==='VN'?<div className="bc-fixed-country">{countryLabel('VN')}</div>:<Select aria-label={title} value={contact.country} options={['CN','TH'].map(code=>({value:code,label:countryLabel(code)}))} onChange={code=>key==='sender'?onRoute(code,'VN'):onRoute('VN',code)}/>}</Field>;
  };
  return <div className="booking-contacts">
    <section className="bc-section"><header><h3><CalendarOutlined/> Hành trình & ngày đi</h3></header>
      {international&&<div className="bc-country-route">{countryControl('sender')}<Button className="bc-swap" aria-label="Đảo chiều hành trình" icon={<SwapOutlined/>} onClick={()=>onRoute(recipient.country,sender.country)}/>{countryControl('recipient')}</div>}
      <div className="bc-date"><Field label="Ngày khởi hành *"><input type="date" required min={earliest} value={date} onChange={e=>onDate(e.target.value)}/></Field><small>Sớm nhất {earliest.split('-').reverse().join('/')}</small></div>
    </section>
    {(['sender','recipient'] as const).map(key=>{
      const contact=key==='sender'?sender:recipient;
      const provinces=locations[contact.country]||[];
      const province=provinces.find(p=>p.name===contact.city);
      const country=countries.find(([code])=>code===contact.country)?.[1]||contact.country;
      return <section className="bc-section" key={key}>
        <header><h3>{key==='sender'?<HomeOutlined/>:<EnvironmentOutlined/>} {key==='sender'?'Người gửi & Điểm đón ngựa':'Người nhận & Điểm giao ngựa'} <small className="bc-contact-country"><CountryFlag country={contact.country}/>{country}</small></h3>
          {key==='sender'&&<Button size="small" icon={<UserOutlined/>} onClick={()=>onContact('sender',{name:account.fullName,phone:account.phone||'',address:account.address||''})}>Tôi là người gửi</Button>}
        </header>
        <div className="bc-grid">
          <Field label={key==='sender'?'Họ tên người gửi / Tên đơn vị *':'Họ tên người nhận / Tên trại đích *'}><input required maxLength={100} value={contact.name} autoComplete="off" onChange={e=>onContact(key,{name:e.target.value})}/></Field>
          <Field label={key==='sender'?'Số điện thoại người gửi *':'Số điện thoại người nhận *'}><input type="tel" required maxLength={30} value={contact.phone} placeholder="VD: +84 901 234 567" onChange={e=>onContact(key,{phone:e.target.value})}/></Field>
          <Field label="Tỉnh / Thành phố *"><select aria-label="Tỉnh / Thành phố *" required value={province?contact.city:''} onChange={e=>onContact(key,{city:e.target.value,ward:''})}><option value="">Chọn tỉnh / thành phố · {country}</option>{provinces.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></Field>
          <Field label="Xã / Phường / Khu vực *"><select aria-label="Xã / Phường / Khu vực *" required disabled={!province} value={province?.wards.includes(contact.ward)?contact.ward:''} onChange={e=>onContact(key,{ward:e.target.value})}><option value="">{province?(contact.country==='VN'?'Chọn xã / phường / khu vực':'Chọn quận / huyện / khu vực'):'Chọn tỉnh / thành phố trước'}</option>{province?.wards.map(ward=><option key={ward} value={ward}>{ward}</option>)}</select></Field>
          <div className="bc-full"><Field label="Tên trang trại / Địa chỉ cụ thể *"><input required maxLength={120} value={contact.address} placeholder="Số nhà, tên đường hoặc tên trang trại" onChange={e=>onContact(key,{address:e.target.value})}/></Field></div>
          <div className="bc-address bc-full"><EnvironmentOutlined/><span><b>Địa chỉ {key==='sender'?'đón':'giao'}:</b> {contactAddress(contact)||'Chưa nhập địa chỉ'}</span></div>
          <Field label="CCCD / MST / Hộ chiếu *"><input required maxLength={30} value={contact.identityNumber} placeholder="Nhập số giấy tờ của người gửi / nhận" onChange={e=>onContact(key,{identityNumber:e.target.value})}/></Field>
        </div>
      </section>;
    })}
  </div>;
}
