// Dependency-free SVG and editable diagrams.net export. Run: node docs/diagrams/generate.cjs
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll('\n','&#xa;');
const colors = ['#eaf3ff','#eaf8f1','#fff3df','#f2edff','#e9f6f8'];
function drawing(name,title,subtitle,w,h) {
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8" fill="none" stroke="#526179"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>`];
  const cells=['<mxCell id="0"/><mxCell id="1" parent="0"/>']; let seq=0;
  function text(x,y,value,size=16,anchor='middle',weight=400) {
    const lines=value.split('\n');
    svg.push(`<text x="${x}" y="${y-(lines.length-1)*10}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="#172c47">${lines.map((l,i)=>`<tspan x="${x}" dy="${i?20:0}">${esc(l)}</tspan>`).join('')}</text>`);
  }
  function node(id,x,y,nw,nh,label,type='action',fill='#eaf3ff') {
    if(type==='action') label=label.split('\n').flatMap(line=>{const result=[];let current='';for(const word of line.split(' ')){if((current+' '+word).trim().length>28&&current){result.push(current);current=word;}else current=(current+' '+word).trim();}result.push(current);return result;}).join('\n');
    let shape='rounded=1;arcSize=20;';
    if(type==='decision') { svg.push(`<polygon points="${x+nw/2},${y} ${x+nw},${y+nh/2} ${x+nw/2},${y+nh} ${x},${y+nh/2}" fill="${fill}" stroke="#526179"/>`); shape='rhombus;'; }
    else if(type==='start'||type==='end') { svg.push(`<circle cx="${x+nw/2}" cy="${y+nh/2}" r="${nw/2}" fill="${type==='start'?'#172c47':'white'}" stroke="#172c47" stroke-width="2"/>`); if(type==='end')svg.push(`<circle cx="${x+nw/2}" cy="${y+nh/2}" r="${nw/2-5}" fill="#172c47"/>`); shape=type==='end'?'shape=doubleEllipse;':'ellipse;'; fill=type==='start'?'#172c47':'#ffffff'; }
    else if(type==='ellipse') {svg.push(`<ellipse cx="${x+nw/2}" cy="${y+nh/2}" rx="${nw/2}" ry="${nh/2}" fill="${fill}" stroke="#526179"/>`);shape='ellipse;';}
    else if(type==='actor') { const cx=x+nw/2; svg.push(`<g fill="none" stroke="#172c47" stroke-width="2"><circle cx="${cx}" cy="${y+12}" r="10"/><path d="M${cx} ${y+22}v30 m-23 -18 h46 M${cx} ${y+52}l-21 25 M${cx} ${y+52}l21 25"/></g>`); text(cx,y+100,label,16);shape='shape=umlActor;';}
    else {svg.push(`<rect x="${x}" y="${y}" width="${nw}" height="${nh}" rx="${type==='box'?0:12}" fill="${fill}" stroke="#bcc8d7"/>`);if(type==='box')shape='rounded=0;';}
    if(!['actor','start','end'].includes(type))text(x+nw/2,y+nh/2+5,label,16);
    cells.push(`<mxCell id="${id}" value="${esc(label)}" style="${shape}whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=#526179;fontColor=#172c47;fontSize=16;fontFamily=Arial;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${nw}" height="${nh}" as="geometry"/></mxCell>`);
    return {id,x,y,w:nw,h:nh};
  }
  function edge(a,b,label='',points,arrow=true,dashed=false) {
    points ||= [[a.x+a.w/2,a.y+a.h],[b.x+b.w/2,b.y]];
    svg.push(`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#526179" stroke-width="1.5" ${arrow?'marker-end="url(#arrow)"':''} ${dashed?'stroke-dasharray="6 5"':''}/>`);
    if(label) {const p=points[Math.floor((points.length-1)/2)],q=points[Math.floor((points.length-1)/2)+1]; const x=(p[0]+q[0])/2,y=(p[1]+q[1])/2;svg.push(`<rect x="${x-label.length*4.5-5}" y="${y-17}" width="${label.length*9+10}" height="23" fill="white"/>`);text(x,y,label,13);}
    cells.push(`<mxCell id="e${++seq}" value="${esc(label)}" style="edgeStyle=none;rounded=0;html=0;endArrow=${arrow?'open':'none'};endFill=0;dashed=${dashed?1:0};fontSize=13;labelBackgroundColor=#ffffff;strokeColor=#526179;" edge="1" parent="1" source="${a.id}" target="${b.id}"><mxGeometry relative="1" as="geometry"><Array as="points">${points.slice(1,-1).map(p=>`<mxPoint x="${p[0]}" y="${p[1]}"/>`).join('')}</Array></mxGeometry></mxCell>`);
  }
  text(32,42,title,26,'start',700);text(32,74,subtitle,15,'start');
  cells.push(`<mxCell id="title" value="${esc(title+'\n'+subtitle)}" style="text;html=0;fontSize=20;align=left;" vertex="1" parent="1"><mxGeometry x="30" y="15" width="${w-60}" height="70" as="geometry"/></mxCell>`);
  function finish(){ fs.writeFileSync(path.join(out,name+'.svg'),svg.join('\n')+'</svg>');fs.writeFileSync(path.join(out,name+'.drawio'),`<mxfile host="app.diagrams.net"><diagram name="${esc(title)}" id="${name}"><mxGraphModel page="1" pageWidth="${w}" pageHeight="${h}"><root>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>`); }
  return {svg,text,node,edge,finish};
}

// Associations express access to grouped user goals, not execution order.
{
 const d=drawing('01-use-case','HorseRoute · Use-case tổng quan','Phạm vi: chức năng đã có trong API/web/mobile · Nhóm các mục tiêu liên quan để dễ đọc',1600,1520);
 d.node('system',240,110,1120,1305,'','box','#fafcff');d.text(800,140,'HỆ THỐNG QUẢN LÝ VẬN CHUYỂN NGỰA',18,'middle',700);
 const rows=[
 ['Khách hàng','CUSTOMER',['Quản lý hồ sơ ngựa\nvà giấy tờ','Tạo, sửa, gửi, hủy\nđơn vận chuyển','Theo dõi hành trình\nvà báo cáo sức khỏe','Xem báo giá\nvà thanh toán']],
 ['Quản lý','MANAGER',['Duyệt đơn và giao\nđiều phối phụ trách','Lập / duyệt báo giá;\nquản lý bảng giá','Duyệt kế hoạch;\nchuyển chuyến READY','Thu tiền / doanh thu;\nduyệt ngoại lệ giao']],
 ['Chuyên viên','SPECIALIST',['Tiếp nhận và kết luận\nthẩm định hồ sơ','Duyệt giấy tờ;\nyêu cầu bổ sung','Cập nhật hồ sơ cơ quan\nvà thông tin hải quan','Quản lý địa điểm;\nxem vận hành']],
 ['Điều phối viên','COORDINATOR',['Lập tuyến, điểm nghỉ;\ngửi duyệt kế hoạch','Quản lý xe; phân công\nxe, tài xế, hộ tống','Giám sát chuyến;\nxử lý sự cố, cảnh báo','Mở ngoại lệ giao ngựa\nđã được quản lý duyệt']],
 ['Tài xế','DRIVER_ESCORT / DRIVER',['Xem chuyến\nđược phân công','Gửi GPS; ghi mốc\nvà check-in điểm dừng','Báo cáo sự cố\ntrong chuyến','Hoàn tất chặng\nvà bàn giao ngựa']],
 ['Hộ tống','DRIVER_ESCORT / ESCORT',['Xem chuyến\nđược phân công','Ghi nhật ký\nchăm sóc ngựa','Soạn và gửi\nbáo cáo sức khỏe','Báo cáo sự cố\ntrong chuyến']],
 ['Quản trị viên','ADMIN',['Tạo, sửa tài khoản\nvà vai trò','Khóa / mở khóa\ntài khoản','Đặt lại mật khẩu\ncho tài khoản','Xem danh sách\nngười dùng']],
 ['Người dùng (*)','Chức năng chung',['Đăng nhập;\nkhôi phục mật khẩu','Cập nhật hồ sơ\nvà đổi mật khẩu','Xem và đánh dấu\nđã đọc thông báo','Đăng ký / xác minh\nemail (chỉ khách)']]
 ];
 const nodes=[];
 rows.forEach(([actor,role,ucs],r)=>{const y=170+r*150;const a=d.node('a'+r,50,y,130,95,actor,'actor');d.text(115,y+124,role,11);const local=[];ucs.forEach((uc,c)=>{const n=d.node(`u${r}_${c}`,275+c*265,y+15,240,76,uc,'ellipse',colors[r%5]);local.push(n);const rail=y-9+c*4;d.edge(a,n,'',[[138,y+34],[222, y+34],[222,rail],[n.x+n.w/2,rail],[n.x+n.w/2,n.y]],false);});nodes.push(local);});
 const vn=d.node('vnpay',1405,175,140,95,'VNPay','actor');d.edge(vn,nodes[0][3],'',[[1452,209],[1310,223]],false);
 d.text(1450,365,'Ngoại lệ giao ngựa:\nquản lý duyệt;\nđiều phối hoặc\nquản lý mở.',13);
 d.text(32,1450,'(*) Mỗi vai trò sử dụng các chức năng chung phù hợp; đăng ký chỉ tạo CUSTOMER. Các use case được gom theo mục tiêu.',15,'start');
 d.text(32,1477,'Tài xế / hộ tống được phân biệt bằng vai trò tổ lái trong chuyến. VNPay là hệ thống ngoài; chế độ mô phỏng chỉ phục vụ thử nghiệm.',15,'start');
 d.finish();
}

function activity(name,title,lanes,rows,nodes,edges,notes) {
 const lw=290, margin=35, top=145, step=113, w=lanes.length*lw+70, h=top+rows*step+115;
 const d=drawing(name,title,'Activity diagram · Làn thể hiện bên chịu trách nhiệm · Nhãn trên nhánh là điều kiện chuyển bước',w,h);
 lanes.forEach((l,i)=>{d.node('lane'+i,margin+i*lw,105,lw,top+rows*step-105,'','box',i%2?'#fafcff':'#ffffff');d.node('header'+i,margin+i*lw,105,lw,42,l,'box',colors[i%5]);});
 const map={};
 for(const [id,l,r,label,type='action'] of nodes){const nw=['start','end'].includes(type)?24:type==='decision'?220:242;const nh=['start','end'].includes(type)?24:type==='decision'?88:68;map[id]=d.node(id,margin+l*lw+(lw-nw)/2,top+r*step+(80-nh)/2,nw,nh,label,type,colors[l%5]);}
 for(const [from,to,label='',route] of edges){const a=map[from],b=map[to];let points;
  if(route){points=route(a,b,{margin,lw,top,step});}
  else if(a.x===b.x || a.x+a.w/2===b.x+b.w/2)points=[[a.x+a.w/2,a.y+a.h],[b.x+b.w/2,b.y]];
  else {const mid=a.y+a.h+17;points=[[a.x+a.w/2,a.y+a.h],[a.x+a.w/2,mid],[b.x+b.w/2,mid],[b.x+b.w/2,b.y]];}
  d.edge(a,b,label,points);
 }
 notes.forEach((n,i)=>d.text(35,h-65+i*23,n,13,'start'));d.finish();
}
const back=(side=0)=>(a,b,{margin,lw})=>{const x=margin+side*lw+8;return [[x>a.x+a.w?a.x+a.w:a.x,a.y+a.h/2],[x,a.y+a.h/2],[x,b.y+b.h/2],[x>b.x+b.w?b.x+b.w:b.x,b.y+b.h/2]];};
const across=(a,b)=>[[a.x+a.w,a.y+a.h/2],[b.x,b.y+b.h/2]];

activity('02-activity-order','HorseRoute · Tiếp nhận đơn và thẩm định hồ sơ',
 ['Khách hàng','Hệ thống','Quản lý','Chuyên viên'],17,[
 ['s',0,0,'','start'],['draft',0,1,'Nhập thông tin vận chuyển,\nngựa và người gửi / nhận'],['submit',0,2,'Lưu nháp và gửi đơn'],['validate',1,3,'Dữ liệu hợp lệ?','decision'],['fix',0,3,'Sửa thông tin theo lỗi'],['pending',1,4,'Ghi nhận đơn PENDING'],['review',2,5,'Xem xét yêu cầu vận chuyển'],['decision',2,6,'Kết quả duyệt đơn?','decision'],['info',0,7,'Bổ sung thông tin\nNEED_INFO'],['reject',1,7,'Ghi lý do từ chối\nĐơn REJECTED'],['rejectedEnd',1,8,'','end'],['approve',2,8,'Duyệt đơn; chọn\nđiều phối viên phụ trách'],['init',1,9,'Đơn APPROVED; tạo chuyến\nvà checklist giấy tờ'],['upload',0,10,'Nộp / bổ sung\ngiấy tờ cho từng ngựa'],['assess',3,11,'Tiếp nhận; duyệt giấy tờ\nvà kiểm tra thời hạn'],['conclude',3,12,'Kết luận thẩm định?','decision'],['supplement',0,13,'Nhận yêu cầu bổ sung\nNEED_INFO'],['reject2',3,14,'Ghi lý do từ chối\nĐơn REJECTED'],['end2',3,15,'','end'],['approved',2,15,'Nhận kết quả\nthẩm định APPROVED'],['end',2,16,'','end']
 ],[
 ['s','draft'],['draft','submit'],['submit','validate'],['validate','fix','Không',(a,b)=>[[a.x,a.y+a.h/2],[b.x+b.w,b.y+b.h/2]]],['fix','draft','',back(0)],['validate','pending','Có'],['pending','review'],['review','decision'],['decision','info','Cần bổ sung'],['info','submit','Gửi lại',back(0)],['decision','reject','Từ chối'],['reject','rejectedEnd'],['decision','approve','Duyệt'],['approve','init'],['init','upload'],['upload','assess'],['assess','conclude'],['conclude','supplement','Cần bổ sung'],['supplement','upload','Nộp lại',back(0)],['conclude','reject2','Từ chối'],['reject2','end2'],['conclude','approved','Đạt'],['approved','end']
 ],['Luồng duyệt đơn và luồng kết luận thẩm định có trạng thái riêng. Giấy tờ có sẵn trong hồ sơ ngựa vẫn cần chuyên viên duyệt.',
 'Sau khi đơn APPROVED, báo giá và lập kế hoạch có thể diễn ra độc lập với thẩm định; không có cổng bắt buộc thẩm định APPROVED ở bước chuyển READY.']);

activity('03-activity-plan','HorseRoute · Lập kế hoạch và cho phép xuất phát',
 ['Điều phối viên','Quản lý','Khách hàng','Hệ thống'],20,[
 ['s',0,0,'','start'],['plan',0,1,'Đơn APPROVED / PREPARING:\nlập tuyến và điểm nghỉ'],['assign',0,2,'Bố trí ngựa lên xe;\nphân công tài xế / hộ tống'],['send',0,3,'Lưu và gửi kế hoạch'],['check',3,4,'Kế hoạch hợp lệ?','decision'],['pending',3,5,'PENDING_APPROVAL;\nđơn chuyển PREPARING'],['review',1,6,'Xét duyệt kế hoạch'],['decision',1,7,'Duyệt kế hoạch?','decision'],['return',0,8,'Nhận lý do trả lại;\nsửa kế hoạch DRAFT'],['approved',1,9,'Kế hoạch APPROVED'],['money',1,10,'Kiểm tra cọc và tờ khai\n(quốc tế) trước khi giao chuyến'],['enough',3,11,'Đủ điều kiện cọc\nvà tờ khai?','decision'],['pay',2,12,'Bổ sung cọc / tờ khai\nhoặc đề nghị ngoại lệ'],['waive',1,13,'Đã bổ sung hoặc\ncó lý do ngoại lệ?','decision'],['wait',2,14,'Chờ bổ sung / xử lý'],['release',1,15,'Yêu cầu chuyển chuyến\ncho tài xế'],['recheck',3,16,'Kế hoạch, xe, tổ lái\nvẫn hợp lệ?','decision'],['blocked',0,17,'Xử lý nguyên nhân bị chặn'],['ready',3,18,'Đơn READY; thông báo\ncho tài xế và khách'],['end',3,19,'','end']
 ],[
 ['s','plan'],['plan','assign'],['assign','send'],['send','check'],['check','plan','Không',back(0)],['check','pending','Có'],['pending','review'],['review','decision'],['decision','return','Trả lại'],['return','plan','',back(0)],['decision','approved','Duyệt'],['approved','money'],['money','enough'],['enough','pay','Thiếu'],['pay','waive'],['waive','wait','Không'],['wait','pay','',back(2)],['waive','release','Có'],['enough','release','Đủ',(a,b)=>[[a.x+a.w,a.y+a.h/2],[1186,a.y+a.h/2],[1186,b.y-12],[b.x+b.w/2,b.y-12],[b.x+b.w/2,b.y]]],['release','recheck'],['recheck','blocked','Không'],['blocked','release','Thử lại',back(1)],['recheck','ready','Có'],['ready','end']
 ],['Báo giá do quản lý lập / duyệt; khách trả cọc qua VNPay hoặc quản lý ghi nhận biên nhận. Đây là luồng độc lập với lập tuyến.',
 'Thiếu cọc / tờ khai có thể được quản lý cho ngoại lệ có lý do và lưu audit. READY chưa phải IN_TRANSIT: tài xế phải ghi mốc xuất phát.']);

activity('04-activity-delivery','HorseRoute · Vận chuyển và bàn giao ngựa',
 ['Tài xế','Hộ tống','Điều phối / Quản lý','Khách hàng','Hệ thống'],21,[
 ['s',0,0,'','start'],['depart',0,1,'Chuyến READY:\nghi mốc DEPARTED'],['check',4,2,'Đủ điều kiện\nxuất phát?','decision'],['fix',2,3,'Xử lý xe / tổ lái / ngựa\nđang bị chặn'],['moving',4,4,'Đơn IN_TRANSIT;\nchặng MOVING'],['drive',0,5,'Di chuyển; gửi GPS;\nghi mốc / check-in'],['care',1,6,'Ghi chăm sóc, sức khỏe;\ngửi báo cáo cho khách'],['incident',1,7,'Có sự cố?','decision'],['report',1,8,'Báo cáo sự cố'],['handle',2,9,'Điều phối xử lý sự cố;\ngửi cảnh báo nếu cần'],['arrive',0,10,'Đến điểm dừng / đích;\nghi nhận thông quan nếu áp dụng'],['last',0,11,'Đã đến chặng cuối?','decision'],['next',0,12,'Hoàn tất chặng trung gian;\nxuất phát chặng tiếp theo'],['paid',4,13,'Đã thanh toán đủ?','decision'],['balance',3,14,'Thanh toán phần còn lại\nhoặc đề nghị giao khi còn nợ'],['exception',2,15,'Đã trả đủ hoặc ngoại lệ\nđã duyệt và mở?','decision'],['hold',3,16,'Chờ thanh toán /\nquyết định ngoại lệ'],['deliver',0,17,'Ghi mốc DELIVERED\ntại chặng cuối'],['gate',4,18,'Kiểm tra quyền giao;\nđơn DELIVERED, chặng COMPLETED'],['end',4,19,'','end']
 ],[
 ['s','depart'],['depart','check'],['check','fix','Không'],['fix','depart','Thử lại',back(0)],['check','moving','Có'],['moving','drive'],['drive','care'],['care','incident'],['incident','report','Có'],['report','handle'],['handle','arrive'],['incident','arrive','Không',(a,b)=>[[a.x,a.y+a.h/2],[328,a.y+a.h/2],[328,b.y-12],[b.x+b.w/2,b.y-12],[b.x+b.w/2,b.y]]],['arrive','last'],['last','next','Chưa'],['next','drive','',back(0)],['last','paid','Rồi'],['paid','balance','Chưa'],['balance','exception'],['exception','hold','Chưa'],['hold','balance','',back(3)],['exception','deliver','Có'],['paid','deliver','Đủ',(a,b)=>[[a.x+a.w,a.y+a.h/2],[1477,a.y+a.h/2],[1477,b.y-15],[b.x+b.w/2,b.y-15],[b.x+b.w/2,b.y]]],['deliver','gate'],['gate','end']
 ],['Trong hành trình, ghi GPS, chăm sóc và xem báo cáo diễn ra lặp lại / độc lập; sơ đồ gom thành một chu kỳ nghiệp vụ.',
 'Ngoại lệ giao khi còn nợ: MANAGER duyệt lý do → COORDINATOR hoặc MANAGER mở → tài xế giao. Khách xem bản đồ theo mốc, không xem GPS nội bộ.']);

const names=['01-use-case','02-activity-order','03-activity-plan','04-activity-delivery'];
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><title>HorseRoute — UML diagrams</title><style>body{font:16px Arial;margin:32px;background:#eef3f8;color:#172c47}h1{margin-bottom:8px}nav{display:flex;gap:18px;flex-wrap:wrap;margin:24px 0}section{background:white;padding:20px;margin-bottom:28px;border-radius:12px;overflow:auto}img{width:100%;min-width:1000px;height:auto}a{color:#175db1}@media print{body{margin:0;background:white}nav,.links{display:none}section{break-before:page;padding:0}img{min-width:0}}</style><h1>HorseRoute · Use-case & Activity diagrams</h1><p>Đối chiếu mã nguồn ngày 18/11/2026. SVG để xem / chèn báo cáo; Draw.io để chỉnh sửa.</p><nav>${names.map((n,i)=>`<a href="#${n}">${i+1}. ${n.slice(3)}</a>`).join('')}</nav>${names.map(n=>`<section id="${n}"><div class="links"><a href="${n}.svg">Mở SVG</a> · <a href="${n}.drawio" download>Tải Draw.io</a></div><img src="${n}.svg" alt="${n}"></section>`).join('')}</html>`);
console.log('Generated 4 SVG diagrams, 4 editable Draw.io diagrams and index.html.');

