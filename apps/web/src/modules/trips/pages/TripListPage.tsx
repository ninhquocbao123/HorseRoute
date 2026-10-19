import { useEffect } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import TripList from '../components/TripList';
import TripListControls from '../components/TripListControls';
import { useTripsQuery } from '../hooks/use-trips-query';
import { useTripListNavigation } from '../hooks/use-trip-list-navigation';

export default function TripListPage() {
  const { account } = useAuth();
  const { params, setPage, setLimit, openTrip } = useTripListNavigation();
  const query = useTripsQuery(params);
  const { data } = query;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / params.limit)) : undefined;
  const outOfRange = lastPage !== undefined && params.page > lastPage;
  useEffect(() => {
    if (query.isSuccess && !query.isFetching && outOfRange) setPage(lastPage!, true);
  }, [query.isSuccess, query.isFetching, outOfRange, lastPage, setPage]);
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined;
  const errorMessage = status === 403 ? 'Bạn không có quyền xem danh sách chuyến.'
    : status === 400 ? 'Tham số danh sách không hợp lệ. Vui lòng chọn lại trang hoặc số dòng.'
    : 'Không tải được danh sách chuyến. Vui lòng thử lại.';
  const loading = query.isPending || outOfRange;

  return (
    <>
      <header className="trip-heading">
        <p className="trip-eyebrow">QUY TRÌNH 03</p>
        <h1>Chuyến vận chuyển</h1>
        <p>{account?.role === 'COORDINATOR' ? 'Các chuyến bạn phụ trách: lập kế hoạch, phân công và chuẩn bị hành trình.' : 'Theo dõi kế hoạch và việc chuẩn bị của tất cả chuyến vận chuyển.'}</p>
      </header>
      <section className="trip-panel" aria-labelledby="trip-list-title">
        <div className="trip-list-heading">
          <h2 id="trip-list-title">Danh sách chuyến</h2>
          {data && <span className="trip-count">{data.total} chuyến</span>}
        </div>
        <p className="trip-timezone">Thời gian hiển thị: Asia/Ho_Chi_Minh (UTC+07:00).</p>
        <TripListControls {...params} total={data?.total} busy={query.isFetching || outOfRange}
          onPageChange={setPage} onLimitChange={setLimit} onRefresh={() => void query.refetch()} />
        {query.isError && <div className="trip-list-error" role="alert">
          <p>{errorMessage}{data && ' Dữ liệu đang hiển thị là kết quả tải trước đó.'}</p>
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Thử lại</button>
        </div>}
        {loading ? <div role="status" aria-label="Đang tải danh sách chuyến" className="trip-list-skeleton">
          <span className="trip-sr-only">Đang tải danh sách chuyến…</span>
          {[0, 1, 2, 3].map(row => <div key={row} aria-hidden="true" />)}
        </div> : data && <>
          <p className="trip-sr-only" role="status">{query.isFetching ? 'Đang cập nhật danh sách…' : `Trang ${params.page}, ${data.items.length} trên ${data.total} chuyến.`}</p>
          {data.items.length ? <TripList items={data.items} onOpenTrip={openTrip} /> : <div className="trip-list-empty">
            <h3>{account?.role === 'COORDINATOR' ? 'Bạn chưa được giao chuyến' : 'Chưa có chuyến vận chuyển'}</h3>
            <p>Chuyến được tạo khi đơn vận chuyển được quản lý phê duyệt.</p>
          </div>}
        </>}
      </section>
    </>
  );
}
