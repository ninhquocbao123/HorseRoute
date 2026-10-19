import { Link, useParams, useSearchParams } from 'react-router-dom';
import { readTripListParams, tripListSearch } from '../utils/trip-list.utils';

export default function TripPlanPage() {
  const { tripId } = useParams();
  const [search] = useSearchParams();
  const listSearch = tripListSearch(readTripListParams(search));
  return (
    <>
      <Link className="trip-back" to={`/dashboard/trips/${encodeURIComponent(tripId ?? '')}${listSearch}`}>← Chi tiết chuyến</Link>
      <header className="trip-heading">
        <p className="trip-eyebrow">QUY TRÌNH 03 · KẾ HOẠCH</p>
        <h1>Kế hoạch chuyến #{tripId}</h1>
        <p>Chuẩn bị lộ trình và thời gian dự kiến cho từng chặng.</p>
      </header>
      <section className="trip-panel trip-placeholder" aria-labelledby="trip-plan-title">
        <span className="trip-placeholder-icon" aria-hidden="true">◇</span>
        <span className="trip-label">Sắp ra mắt</span>
        <h2 id="trip-plan-title">Khu vực lập kế hoạch</h2>
        <p>Biểu mẫu các chặng đang được chuẩn bị. Bạn chưa thể nhập hoặc lưu kế hoạch tại đây.</p>
      </section>
    </>
  );
}
