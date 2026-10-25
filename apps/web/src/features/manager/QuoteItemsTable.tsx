import {Fragment} from 'react';
type Item={code:string;label:string;unitPrice:number;quantity:number;amount:number};
const money=(value:number)=>Number(value).toLocaleString('vi-VN')+' đ';
const groups=[{id:'transport',name:'Vận chuyển',codes:['TRANSPORT','EXCESS_DISTANCE','CREW','FUEL']},{id:'care',name:'Chăm sóc ngựa',codes:['WATER','EXTRA_STALL','FEED']},{id:'procedure',name:'Thủ tục',codes:['INTERNATIONAL']},{id:'insurance',name:'Bảo hiểm',codes:['INSURANCE']},{id:'other',name:'Chi phí khác',codes:[]}];
export default function QuoteItemsTable({items}:{items:Item[]}){
 const total=items.reduce((sum,item)=>sum+Number(item.amount),0),known=groups.flatMap(g=>g.codes);
 return <div className="mgr-table-wrap mq-items"><table><thead><tr><th>Hạng mục</th><th>Đơn giá</th><th>SL</th><th>Thành tiền</th></tr></thead><tbody>{groups.map(group=>{const rows=items.filter(i=>group.id==='other'?!known.includes(i.code):group.codes.includes(i.code));if(!rows.length)return null;const sum=rows.reduce((value,item)=>value+Number(item.amount),0);return <Fragment key={group.id}><tr className={'mq-group mq-'+group.id}><th colSpan={3} scope="rowgroup"><i/>{group.name}<span>{total>0?Math.round(sum/total*100):0}%</span></th><td>{money(sum)}</td></tr>{rows.map(item=><tr key={item.code}><td>{item.label}</td><td>{money(item.unitPrice)}</td><td>{Number(Number(item.quantity).toFixed(2)).toLocaleString('vi-VN')}</td><td>{money(item.amount)}</td></tr>)}</Fragment>;})}</tbody></table></div>;
}
