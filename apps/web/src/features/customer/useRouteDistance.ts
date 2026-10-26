import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../lib/axios';
import type { BookingContact } from './BookingContacts';
type Result = {distanceKm:number;precision:'ward'|'city'};
export default function useRouteDistance(sender:BookingContact,recipient:BookingContact) {
  const point=(p:BookingContact)=>({country:p.country,city:p.city,ward:p.ward});
  const key=JSON.stringify({from:point(sender),to:point(recipient)});
  const complete=!!(sender.city&&sender.ward&&recipient.city&&recipient.ward);
  const [retry,setRetry]=useState(0);
  const [state,setState]=useState<{key:string;result:Result|null;error:string;loading:boolean}>({key:'',result:null,error:'',loading:false});
  useEffect(()=>{
    if(!complete)return;
    const controller=new AbortController();let alive=true;
    setState({key,result:null,error:'',loading:true});
    const timer=setTimeout(()=>{void api.post<Result>('/customer/route-distance',JSON.parse(key),{signal:controller.signal,timeout:60000}).then(({data})=>{
      if(!Number.isInteger(data.distanceKm)||data.distanceKm<1)throw new Error('Invalid distance');
      if(alive)setState({key,result:data,error:'',loading:false});
    }).catch(error=>{if(alive)setState({key,result:null,error:isAxiosError(error)?String(error.response?.data?.message||'Chưa tính được quãng đường. Vui lòng thử lại.'):'Chưa tính được quãng đường. Vui lòng thử lại.',loading:false});});},700);
    return()=>{alive=false;clearTimeout(timer);controller.abort();};
  },[key,complete,retry]);
  const current=complete&&state.key===key;
  return {key,result:current?state.result:null,loading:complete&&(!current||state.loading),error:current?state.error:'',complete,retry:()=>{setState({key,result:null,error:'',loading:true});setRetry(n=>n+1);}};
}
