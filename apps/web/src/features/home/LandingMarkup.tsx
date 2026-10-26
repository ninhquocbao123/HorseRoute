import BrandLogo from '../../components/BrandLogo';
import type { CSSProperties } from "react";
import domestic from "../../assets/landing-v7/domestic.png";
import crossBorder from "../../assets/landing-v7/cross-border.png";
import quarantine from "../../assets/landing-v7/quarantine.png";
import care from "../../assets/landing-v7/horse-care.png";
const serviceImages=[domestic,crossBorder,quarantine,care];
export default function LandingMarkup(){return (<div id="home"><header><div className="wrap hb"><a className="logo" href="#/"><BrandLogo />{"Vận chuyển ngựa"}</a>
<nav><a href="#mang-luoi">{"Mạng lưới"}</a><a href="#dich-vu">{"Dịch vụ"}</a><a href="#quy-trinh">{"Quy trình"}</a><a href="#tra-cuu">{"Tra cứu"}</a><div className="tools" data-tools></div><a className="btn line sm" href="#/login">{"Đăng nhập"}</a><a className="btn" href="#/login">{"Đặt chuyến"}</a></nav></div></header>
<main>
<section className="hero" style={{"paddingBottom": "96px"}}><div className="wrap hg">
<div><span className="badge"><i></i>{"Xe chuyên dụng 2 – 9 ngăn"}</span>
<h1>{"Vận chuyển ngựa đua "}<em>{"Việt Nam · Trung Quốc · Thailand"}</em></h1>
<p>{"Xe nguyên chuyến chỉ chở ngựa của bạn, mỗi xe có tài xế và nhân viên chăm sóc riêng. Bạn theo dõi xe đang ở đâu trên bản đồ."}</p>
<div className="cta"><a className="btn" href="#/login">{"Đặt chuyến ngay"}</a><a className="btn line" href="#quy-trinh">{"Xem quy trình"}</a></div>
<div className="pts"><span><b>{"3"}</b>{"quốc gia"}</span><span><b>{"10+"}</b>{"cửa khẩu"}</span><span><b>{"24 giờ"}</b>{"hiệu lực báo giá"}</span></div></div>
<div className="vis"><svg viewBox="0 0 520 330" aria-label="Xe chạy quanh trường đua"><path className="o" d="M130 60H390A105 105 0 0 1 390 270H130A105 105 0 0 1 130 60Z"></path><path className="o2" d="M130 60H390A105 105 0 0 1 390 270H130A105 105 0 0 1 130 60Z"></path><path className="lap" id="lp" d="M130 60H390A105 105 0 0 1 390 270H130A105 105 0 0 1 130 60Z"></path>
<circle className="pin" cx="260" cy="60" r="8"></circle><text className="pt" x="260" y="42" textAnchor="middle">{"Hà Nội"}</text>
<circle className="pin" cx="495" cy="165" r="8" style={{"display": "none"}}></circle>
<circle className="pin" cx="260" cy="270" r="8"></circle><text className="pt" x="260" y="304" textAnchor="middle">{"TP.HCM"}</text>
<g className="tk" id="tk"><rect x="-18" y="-12" width="24" height="17" rx="3"></rect><path d="M6-7h7l5 7v5H6z"></path><circle cx="-10" cy="8" r="4"></circle><circle cx="12" cy="8" r="4"></circle></g></svg>
<div className="chip c1"><span className="dot"></span><div><b>{"Đang di chuyển"}</b><small>{"Tài xế vừa check-in"}</small></div></div>
<div className="chip c2"><div><b>{"Hồ sơ đã duyệt"}</b><small>{"Kiểm dịch viên xác nhận"}</small></div></div></div>
</div></section>
<section className="alt" id="tra-cuu" style={{"padding": "72px 0"}}><div className="wrap" style={{"maxWidth": "1440px"}}><div className="public-customer-portal">
<aside className="side"><h2>{"Cổng khách hàng"}</h2><p>{"Theo dõi chuyến đang chạy hoặc xem giá trước khi đặt."}</p>
<button className="ho" aria-pressed="true" data-p="0"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg><span><b>{"Tra cứu đơn hàng"}</b><small>{"Xem xe đang ở đâu"}</small></span></button>
<button className="ho" aria-pressed="false" data-p="1"><svg viewBox="0 0 24 24"><path d="M4 7h16v11H4zM4 11h16M8 15h3"></path></svg><span><b>{"Bảng giá cước"}</b><small>{"Ước tính chi phí chuyến"}</small></span></button>
<div className="hot">{"Báo giá chính thức đã gồm nhiên liệu, cầu đường, không phụ thu ngoài phiếu."}</div></aside>
<div className="main" data-m="0"><h3>{"Tra cứu đơn hàng"}</h3><p>{"Nhập mã đơn và 4 số cuối số điện thoại người đặt."}</p>
<form id="lf"><div className="fr2"><label className="fl2">{"Mã đơn"}<input placeholder="Ví dụ: BK-1024" required /></label><label className="fl2">{"4 số cuối SĐT"}<input inputMode="numeric" maxLength={4} placeholder="Ví dụ: 4567" required /></label></div><button className="btn pbtn" type="submit">{"Tìm kiếm"}</button></form>
<ol className="trace" id="trace"><li>{"Đã nhận đơn"}</li><li>{"Thẩm định"}</li><li>{"Làm giấy tờ"}</li><li>{"Đang vận chuyển"}</li><li>{"Bàn giao"}</li></ol><p className="note" id="res" role="status">{"Kết quả sẽ hiện ở đây sau khi tra cứu."}</p></div>
<div className="main" data-m="1" hidden><h3>{"Bảng giá và dự toán chuyến đi"}</h3><p>{"Chọn thông tin chuyến, tổng chi phí ước tính cập nhật ngay."}</p>
<div className="lbl3" style={{"marginTop": "0"}}>{"Quãng đường"}</div><div className="dist" id="dist"></div>
<div className="lbl3">{"Hạng xe"}</div><div className="cls" id="cls"></div>
<div className="lbl3">{"Ngựa và dịch vụ kèm theo"}</div>
<div className="opts"><div className="og">{"Số ngựa"}<div className="step"><button type="button" id="mn" aria-label="Giảm">{"−"}</button><b id="nn">{"1"}</b><button type="button" id="pl" aria-label="Tăng">{"+"}</button></div></div>
<label className="og">{"Bảo hiểm động vật sống"}<select id="ins"></select></label>
<label className="og">{"Thức ăn"}<select id="food"><option value="STANDARD">{"Gói tiêu chuẩn (đã gồm)"}</option><option value="PREMIUM">{"Gói nâng cao"}</option><option value="SPORT">{"Gói thể thao"}</option></select></label></div>
<div className="opts" style={{"marginTop": "12px"}}><label className="chk2"><input type="checkbox" id="ext" />{"Khoang đơn mở rộng"}</label><label className="chk2"><input type="checkbox" id="intl" />{"Chuyến quốc tế (kiểm dịch, hải quan)"}</label></div>
<div className="opts" style={{marginTop:12}}><label className="og">Số ngày dự kiến<input id="pricing-days" type="number" min={1} max={60} defaultValue={1}/></label><label className="og">Cữ nước<select id="pricing-water"><option value="EVERY_2_HOURS">Mỗi 2 giờ</option><option value="EVERY_HOUR">Mỗi giờ</option></select></label><label className="og">Số cữ nước dự kiến<input id="pricing-water-rounds" type="number" min={0} max={1000} defaultValue={4}/></label></div><p className="note" id="pricing-version-note" role="status">Đang tải bảng giá…</p>
<div className="bill"><div id="bl"></div><div className="tot"><div><small>{"Tổng ước tính"}</small><b id="tt">{"–"}</b></div><a className="btn" href="#/login">{"Đặt chuyến này"}</a></div></div>
<h3 className="sub">{"Cước vận chuyển mỗi xe"}</h3>
<div className="tw"><table className="hm"><thead><tr><th><div>{"Quãng đường"}</div></th><th><div>{"Light"}<small>{"2 ngăn"}</small></div></th><th><div>{"Medium"}<small>{"4 đến 6 ngăn"}</small></div></th><th><div>{"Heavy"}<small>{"9 ngăn"}</small></div></th></tr></thead><tbody id="tb"></tbody></table></div>
<h3 className="sub">{"Các khoản cố định khác"}</h3>
<div className="grps">
<div className="gp"><h4>{"Nhân sự, nhiên liệu"}</h4><div className="rw"><span>{"Tài xế + hộ tống, mỗi xe"}</span><i></i><b data-fee="crewPerDay" data-unit="/ngày">{"—"}</b></div><div className="rw"><span>{"Nhiên liệu, cầu đường, mỗi xe"}</span><i></i><b data-fee="fuelPer100Km" data-unit="/100 km">{"—"}</b></div></div>
<div className="gp"><h4>{"Chăm sóc ngựa"}</h4><div className="rw"><span>{"Khoang đơn mở rộng"}</span><i></i><b data-fee="extraStallPerHorse" data-unit="/ngựa/chuyến">{"—"}</b></div><div className="rw"><span>{"Thức ăn nâng cao"}</span><i></i><b data-fee="premiumFeedPerHorse" data-unit="/ngựa/chuyến">{"—"}</b></div><div className="rw"><span>{"Thức ăn thể thao"}</span><i></i><b data-fee="sportFeedPerHorse" data-unit="/ngựa/chuyến">{"—"}</b></div><div className="rw"><span>{"Cữ nước mỗi 2 giờ"}</span><i></i><b data-fee="water2hPerHorse" data-unit="/ngựa/cữ">{"—"}</b></div><div className="rw"><span>{"Cữ nước mỗi giờ"}</span><i></i><b data-fee="water1hPerHorse" data-unit="/ngựa/cữ">{"—"}</b></div></div>
<div className="gp"><h4>{"Giấy tờ"}</h4><div className="rw"><span>{"Kiểm dịch nội địa"}</span><i></i><b>{"Đã gồm trong cước"}</b></div><div className="rw"><span>{"Kiểm dịch, hải quan quốc tế"}</span><i></i><b data-fee="internationalPerTrip" data-unit="/chuyến">{"—"}</b></div></div>
<div className="gp"><h4>{"Bảo hiểm động vật sống"}</h4><div id="insl"></div></div></div>
<p className="note">{"Dự toán đã cộng cước cơ bản, nhân sự theo số ngày, nhiên liệu theo km, cữ nước và dịch vụ đã chọn. Số ngày và cữ nước là dự kiến; báo giá chính thức do Manager xác nhận. Không tính giá trị này là khoản đã thanh toán."}</p></div>
</div></div></section>
<section style={{"paddingBottom": "40px"}}><div className="wrap g3">
<div className="card rv"><div className="ic"><svg><use href="#i-truck"></use></svg></div><h3>{"Xe chuyên dụng"}</h3><p>{"Xe nguyên chuyến với khoang phù hợp số ngựa của bạn, không ghép đơn khác."}</p></div>
<div className="card rv" style={{"--d": "100ms"} as CSSProperties}><div className="ic"><svg><use href="#i-doc"></use></svg></div><h3>{"Hỗ trợ giấy tờ"}</h3><p>{"Đội ngũ phụ trách kiểm dịch và thủ tục cho chuyến đi."}</p></div>
<div className="card rv" style={{"--d": "200ms"} as CSSProperties}><div className="ic"><svg><use href="#i-pin"></use></svg></div><h3>{"Theo dõi hành trình"}</h3><p>{"Cập nhật tiến độ đơn và vị trí xe trên hệ thống."}</p></div>
</div></section>
<section id="mang-luoi"><div className="wrap net">
<div className="rv"><span className="lab">{"Mạng lưới"}</span><h2 className="h2">{"Phủ sóng ba nước bằng đường bộ"}</h2><p className="lead">{"Chọn điểm đón và điểm giao, nhà xe lo cửa khẩu và các trạm nghỉ dọc đường."}</p>
<div className="cl" id="cl"></div></div>
<div className="map rv" style={{"--d": "120ms"} as CSSProperties}><div className="mfl" id="mflag"></div><svg viewBox="0 0 900 210" aria-label="Tuyến mẫu"><path className="trk" id="p" d="M 50 70 C 210 -20, 280 90, 450 140 S 690 150, 850 60"></path><path className="pth" id="pp" d="M 50 70 C 210 -20, 280 90, 450 140 S 690 150, 850 60"></path>
<circle className="stp" cx="50" cy="70" r="11"></circle><circle className="stp" cx="450" cy="140" r="12"></circle><circle className="stp" cx="850" cy="60" r="11"></circle>
<text className="jl" x="50" y="104" textAnchor="middle" id="l0"></text><text className="js" x="50" y="120" textAnchor="middle">{"Đón ngựa"}</text>
<text className="jl" x="450" y="176" textAnchor="middle" id="l1"></text><text className="js" x="450" y="192" textAnchor="middle">{"Chăm sóc trên đường"}</text>
<text className="jl" x="850" y="94" textAnchor="middle" id="l2"></text><text className="js" x="850" y="110" textAnchor="middle">{"Bàn giao ngựa"}</text>
<g className="tk" id="tk2"><rect x="-18" y="-12" width="24" height="17" rx="3"></rect><path d="M6-7h7l5 7v5H6z"></path><circle cx="-10" cy="8" r="4"></circle><circle cx="12" cy="8" r="4"></circle></g></svg>
<div className="mi"><span>{"Điểm phục vụ"}<b>{"10+ điểm nhận, giao"}</b></span><span>{"Tuyến quốc tế"}<b>{"10+ cửa khẩu"}</b></span></div></div>
</div></section>
<section className="alt" id="dich-vu"><div className="wrap"><div className="head rv"><span className="lab">{"Dịch vụ"}</span><h2 className="h2">{"Mọi thứ ngựa của bạn cần trên đường"}</h2></div>
<div className="g4">
<a className="sv rv" href="#/login"><div className="art"><img src={serviceImages[0]} alt="Xe container vận chuyển nội địa" loading="lazy" style={{"objectPosition": "35% 50%"}} /></div><div className="sb"><h3>{"Vận chuyển nội địa"}</h3><p>{"Giữa các kho và câu lạc bộ trong nước, có trạm nghỉ cho ngựa."}</p><span>{"Xem giá cước"}</span></div></a>
<a className="sv rv" style={{"--d": "100ms"} as CSSProperties} href="#mang-luoi"><div className="art"><img src={serviceImages[1]} alt="Xe container tại bãi hàng quốc tế" loading="lazy" style={{"objectPosition": "55% 50%"}} /></div><div className="sb"><h3>{"Xuyên biên giới"}</h3><p>{"Việt Nam – Trung Quốc, Việt Nam – Thailand, nhà xe làm thủ tục cửa khẩu."}</p><span>{"Xem mạng lưới"}</span></div></a>
<a className="sv rv" style={{"--d": "200ms"} as CSSProperties} href="#quy-trinh"><div className="art"><img src={serviceImages[2]} alt="Kiểm dịch viên khám ngựa" loading="lazy" style={{"objectPosition": "25% 40%"}} /></div><div className="sb"><h3>{"Kiểm dịch, thủ tục"}</h3><p>{"Giấy kiểm dịch và tờ khai hải quan do nhà xe làm trọn gói."}</p><span>{"Xem quy trình"}</span></div></a>
<a className="sv rv" style={{"--d": "300ms"} as CSSProperties} href="#/login"><div className="art"><img src={serviceImages[3]} alt="Ngựa bên cạnh xe vận chuyển chuyên dụng" loading="lazy" style={{"objectPosition": "60% 40%"}} /></div><div className="sb"><h3>{"Chăm sóc, bảo hiểm"}</h3><p>{"Hộ tống đi kèm, khoang đơn mở rộng, bảo hiểm động vật sống."}</p><span>{"Xem giá cước"}</span></div></a>
</div></div></section>
<section id="quy-trinh"><div className="wrap"><div className="head rv"><span className="lab">{"Quy trình"}</span><h2 className="h2">{"Sáu bước từ gửi đơn đến bàn giao"}</h2><p className="lead">{"Từ lúc gửi đơn đến khi bạn nghiệm thu ngựa tại điểm đến."}</p></div>
<div className="flow rv"><ol className="fls" id="fls"></ol><div className="flv" id="flv" aria-live="polite"></div></div></div></section>
<div className="band"><div className="wrap sts">
<div className="rv"><b data-n="3">{"0"}</b><span>{"quốc gia"}</span></div><div className="rv"><b data-n="9">{"0"}</b><span>{"ngăn tối đa mỗi xe"}</span></div>
<div className="rv"><b data-n="10" data-s="+">{"0"}</b><span>{"cửa khẩu"}</span></div><div className="rv"><b data-n="30" data-s="%">{"0"}</b><span>{"đặt cọc nhận vận đơn"}</span></div></div></div>
<section id="dat-chuyen"><div className="wrap"><div className="cb2 rv"><h2>{"Đặt chuyến vận chuyển ngựa đua"}</h2><p>{"Đặt trước tối thiểu 20 ngày. Báo giá cố định, đặt cọc 30% để nhận vận đơn."}</p><a className="btn" href="#/login">{"Đặt chuyến ngay"}</a></div></div></section>
</main>
<footer><div className="wrap"><div className="fg"><div><a className="logo" href="#/" style={{"color": "#fff"}}><BrandLogo />{"Vận chuyển ngựa"}</a><p style={{"maxWidth": "40ch"}}>{"Vận chuyển ngựa đua đường bộ trong Việt Nam và giữa Việt Nam với Trung Quốc, Thailand."}</p></div>
<div><h4>{"Tra cứu"}</h4><a href="#tra-cuu">{"Tra cứu đơn hàng"}</a><a href="#tra-cuu">{"Bảng giá"}</a><a href="#mang-luoi">{"Mạng lưới"}</a></div>
<div><h4>{"Khách hàng"}</h4><a href="#/login">{"Đăng nhập"}</a><a href="#/register">{"Đăng ký"}</a><a href="#/login">{"Đặt chuyến"}</a></div></div><div className="cp">{"© 2026 Vận chuyển ngựa"}</div></div></footer>
</div>);}
