import { useEffect, useState } from 'react';
import BrandLogo from '../BrandLogo';
import './page-loader.css';

/** Mốc thời gian của màn tải (plan_design mục 2.7 và trạng thái "mạng chậm"). */
export const LOADER_DELAY_MS = 200;
export const LOADER_SLOW_MS = 6_000;
export const LOADER_STUCK_MS = 15_000;
/** Màn tải nối tiếp (kiểm tra phiên → tải code trang → tải dữ liệu) trong khoảng này coi là một lần chờ. */
const CHAIN_GAP_MS = 400;

// Chuỗi màn tải đang diễn ra: màn sau tiếp nối màn trước thì hiện ngay, mốc "chậm" tính từ màn đầu tiên.
// Lúc tải JS, màn tĩnh trong index.html vừa hiện: màn tải đầu tiên của React tiếp nối nó, tính giờ từ lúc mở trang.
let chainStart = Date.now() - (typeof performance !== 'undefined' ? performance.now() : 0);
let lastEnded = Date.now();
let mounted = 0;

/**
 * Màn tải toàn trang (thay chữ "Đang tải..." trơn).
 * - `brand`: chưa biết vai trò (kiểm tra phiên, tải code trang): logo, thanh tiến trình, dòng trạng thái.
 * - `content`: đã ở trong khung trang (tài xế, hộ tống...): skeleton tiêu đề, ô số liệu và thẻ nội dung.
 * Không hiện gì trong 200 ms đầu để lần tải nhanh không bị nháy. Sau 6 giây báo đang lâu hơn bình thường,
 * sau 15 giây có nút tải lại trang. Theo chế độ sáng/tối (token) và tắt chuyển động khi người dùng chọn giảm chuyển động.
 */
export default function PageLoader({ label = 'Đang tải', variant = 'brand' }: { label?: string; variant?: 'brand' | 'content' }) {
  const [start] = useState(() => {
    const now = Date.now();
    if (!mounted && now - lastEnded > CHAIN_GAP_MS) chainStart = now;
    return chainStart;
  });
  const stageAt = (elapsed: number) => elapsed >= LOADER_STUCK_MS ? 'stuck' : elapsed >= LOADER_SLOW_MS ? 'slow' : elapsed >= LOADER_DELAY_MS ? 'shown' : 'hidden';
  const [stage, setStage] = useState<'hidden' | 'shown' | 'slow' | 'stuck'>(() => stageAt(Date.now() - start));
  useEffect(() => {
    mounted++;
    const elapsed = Date.now() - start;
    const timers = [LOADER_DELAY_MS, LOADER_SLOW_MS, LOADER_STUCK_MS]
      .filter(at => at > elapsed)
      .map(at => setTimeout(() => setStage(stageAt(Date.now() - start)), at - elapsed));
    return () => { timers.forEach(clearTimeout); mounted--; lastEnded = Date.now(); };
  }, [start]);
  const status = (
    <div className="hr-loader-status">
      <p className="hr-loader-label">{label}<span className="hr-loader-dots" aria-hidden="true" /></p>
      {stage === 'slow' && <p className="hr-loader-note">Kết nối đang chậm hơn bình thường. Vui lòng chờ thêm một chút.</p>}
      {stage === 'stuck' && (
        <p className="hr-loader-note">
          Vẫn chưa tải xong. Kiểm tra kết nối mạng rồi{' '}
          <button type="button" className="hr-loader-retry" onClick={() => window.location.reload()}>tải lại trang</button>.
        </p>
      )}
    </div>
  );

  if (variant === 'content') {
    return (
      <div className="hr-loader-content" role="status" aria-live="polite" aria-busy="true" data-stage={stage}>
        <span className="hr-skeleton hr-loader-sk-title" />
        <span className="hr-skeleton hr-loader-sk-sub" />
        <div className="hr-loader-sk-stats">{[0, 1, 2].map(i => <span key={i} className="hr-skeleton" />)}</div>
        <div className="hr-loader-sk-card">
          <span className="hr-skeleton" style={{ width: '42%' }} />
          <span className="hr-skeleton" style={{ width: '88%' }} />
          <span className="hr-skeleton" style={{ width: '74%' }} />
          <span className="hr-skeleton" style={{ width: '81%' }} />
        </div>
        {status}
      </div>
    );
  }

  return (
    <main className="hr-loader" role="status" aria-live="polite" aria-busy="true" data-stage={stage}>
      <div className="hr-loader-bar" aria-hidden="true"><span /></div>
      <div className="hr-loader-center">
        <div className="hr-loader-mark"><BrandLogo /></div>
        <strong className="hr-loader-name">HorseRoute</strong>
        {status}
      </div>
    </main>
  );
}
