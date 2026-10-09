import { Link } from "react-router-dom";
import { useAuth } from "../auth/hooks/useAuth";

export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">H</span>
      <span>
        HorseSystem<small>EQUINE TRANSPORT</small>
      </span>
    </Link>
  );
}
export default function LandingPage() {
  const { user } = useAuth();
  const destination = user ? "/dashboard" : "/login";
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <nav aria-label="Điều hướng chính">
          <a href="#services">Dịch vụ</a>
          <a href="#process">Quy trình</a>
          <a href="#questions">Giải đáp</a>
        </nav>
        <Link className="button" to={destination}>
          {user ? "Tài khoản của tôi" : "Đăng nhập"} ↗
        </Link>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">ĐỒNG HÀNH TRÊN MỌI HÀNH TRÌNH</p>
            <h1>
              Mỗi hành trình.
              <br />
              Một sự <em>an tâm.</em>
            </h1>
            <p className="hero-description">
              Chăm chút từng chặng đường cho người bạn bốn chân. Quản lý vận
              chuyển ngựa, hồ sơ và lịch trình trong một không gian kết nối.
            </p>
            <div className="hero-actions">
              <Link className="button" to={destination}>
                Bắt đầu hành trình ↗
              </Link>
              <a href="#services" className="text-link">
                Khám phá dịch vụ ↓
              </a>
            </div>
            <div className="hero-note">
              <span>◇</span>
              <p>
                Sự an toàn của ngựa.
                <br />
                <strong>Ưu tiên trong từng quyết định.</strong>
              </p>
            </div>
          </div>
          <div className="hero-photo">
            <img
              src="https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?auto=format&fit=crop&w=1400&q=85"
              alt="Ngựa trên đồng cỏ"
              fetchPriority="high"
            />
            <div className="photo-caption">
              <small>BUILT AROUND THEIR WELLBEING</small>
              <h2>
                Không chỉ là vận chuyển.
                <br />
                Là sự chăm sóc xuyên suốt.
              </h2>
              <span>01 / HorseSystem EQUINE</span>
            </div>
          </div>
        </section>
        <div className="value-strip">
          <span>Chăm sóc theo hành trình</span>
          <i>✦</i>
          <span>Hồ sơ tập trung</span>
          <i>✦</i>
          <span>Phối hợp xuyên suốt</span>
          <i>✦</i>
          <span>Kết nối mọi chặng đường</span>
        </div>
        <section id="services" className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DỊCH VỤ CỦA CHÚNG TÔI</p>
              <h2>
                Một hành trình trọn vẹn.
                <br />
                Từng chi tiết được quan tâm.
              </h2>
            </div>
            <p>
              Từ bước chuẩn bị đến khi bàn giao, HorseSystem kết nối thông tin
              giữa khách hàng và đội ngũ vận chuyển.
            </p>
          </div>
          <div className="service-grid">
            {[
              [
                "↗",
                "Điều phối vận chuyển",
                "Kết nối đơn vận chuyển với kế hoạch, phương tiện và đội ngũ phụ trách từng chặng.",
              ],
              [
                "▤",
                "Hồ sơ & giấy tờ",
                "Tập trung thông tin ngựa, giấy tờ và hồ sơ kiểm dịch để thuận tiện theo dõi, bổ sung.",
              ],
              [
                "♡",
                "Theo dõi hành trình",
                "Theo dõi các mốc vận chuyển, nhật ký tình trạng ngựa và thông tin sự cố trong chuyến đi.",
              ],
            ].map(([icon, title, description], i) => (
              <article className="service-card" key={title}>
                <div className="service-top">
                  <span>{icon}</span>
                  <small>0{i + 1}</small>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="process" className="section process">
          <div>
            <p className="eyebrow">RÕ RÀNG TỪ BƯỚC ĐẦU TIÊN</p>
            <h2>
              Bạn trao niềm tin.
              <br />
              Chúng tôi cùng đồng hành.
            </h2>
            <Link className="text-link" to={destination}>
              Kết nối với HorseSystem ↗
            </Link>
          </div>
          <ol>
            {[
              [
                "Gửi thông tin vận chuyển",
                "Chuẩn bị thông tin ngựa, điểm đi, điểm đến và thời gian mong muốn.",
              ],
              [
                "Hoàn thiện hồ sơ & kế hoạch",
                "Phối hợp bổ sung giấy tờ và thống nhất kế hoạch cho chuyến đi.",
              ],
              [
                "Theo dõi & bàn giao",
                "Cập nhật tiến độ, tình trạng ngựa và các mốc hoàn thành hành trình.",
              ],
            ].map(([title, description], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="questions" className="section faq">
          <p className="eyebrow">TRƯỚC KHI KHỞI HÀNH</p>
          <h2>Những điều bạn cần biết.</h2>
          {[
            [
              "Tôi cần chuẩn bị những thông tin gì?",
              "Thông tin nhận dạng ngựa, địa chỉ nhận và giao, ngày dự kiến cùng các yêu cầu chăm sóc riêng. Giấy tờ cụ thể phụ thuộc vào tuyến vận chuyển.",
            ],
            [
              "Làm thế nào để truy cập tài khoản?",
              "Chọn Đăng nhập và sử dụng email, mật khẩu đã đăng ký. Nếu chưa có tài khoản, chọn Tạo tài khoản tại trang đăng nhập.",
            ],
            [
              "Giấy tờ kiểm dịch có giống nhau ở mọi tuyến không?",
              "Yêu cầu phụ thuộc quốc gia xuất phát, quốc gia đến và cơ quan tiếp nhận. Cần xác nhận hồ sơ phù hợp trước khi khởi hành.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="closing">
          <p className="eyebrow">SẴN SÀNG CHO CHẶNG ĐƯỜNG TIẾP THEO?</p>
          <h2>
            Hành trình an tâm
            <br />
            bắt đầu từ đây.
          </h2>
          <Link className="button light" to={destination}>
            Truy cập tài khoản ↗
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <Brand />
        <p>Chăm chút mỗi chặng đường.</p>
        <small>
          © {new Date().getFullYear()} HorseSystem Equine Transport.
        </small>
      </footer>
    </div>
  );
}
