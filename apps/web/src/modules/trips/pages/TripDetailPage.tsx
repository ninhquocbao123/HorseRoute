import {useFeedback} from '../../../components/useFeedback';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { isValidTripId } from '../utils/trip-detail.utils';
import { useTripDetailQuery } from '../hooks/use-trip-detail-query';
import TripStatusBadge, { OrderStatusBadge } from '../components/TripStatusBadge';
import TripSummary from '../components/TripSummary';
import TripDetailTabs from '../components/TripDetailTabs';
import TripLegTimeline from '../components/TripLegTimeline';
import { VALID_DETAIL_TABS } from '../constants/trip-status.constants';
import { readTripListParams, tripListSearch } from '../utils/trip-list.utils';
import type { TripDetailTab } from '../types/trip.types';
import { reviewTripPlan } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
import TripReviewDialog from '../components/TripReviewDialog';
import TripAssignmentsPanel from '../components/TripAssignmentsPanel';
import TripRoutePlanSummary from '../components/TripRoutePlanSummary';

function readTab(search: URLSearchParams): TripDetailTab {
  const raw = search.get('tab');
  return raw && VALID_DETAIL_TABS.has(raw) ? (raw as TripDetailTab) : 'plan';
}

export default function TripDetailPage() {
  const { tripId } = useParams();
  const [search, setSearch] = useSearchParams();
  const listSearch = tripListSearch(readTripListParams(search));
  const activeTab = readTab(search);
  const { account } = useAuth();
  const { message: messageApi } = useFeedback();
  const [reviewOpen,setReviewOpen]=useState(false); const [reviewing,setReviewing]=useState(false); const qc=useQueryClient();

  const query = useTripDetailQuery(tripId);
  const { data: trip } = query;

  const setTab = (tab: TripDetailTab) => {
    const next = new URLSearchParams(search);
    next.set('tab', tab);
    setSearch(next, { replace: true });
  };

  useEffect(() => {
    const tab = search.get('tab');
    if (!tab || !VALID_DETAIL_TABS.has(tab) || search.getAll('tab').length !== 1) {
      const next = new URLSearchParams(search);
      next.set('tab', 'plan');
      setSearch(next, { replace: true });
    }
  }, [search, setSearch]);

  if (!isValidTripId(tripId)) {
    return <div className="trip-detail-error" role="alert">
      <h1>ID chuyến không hợp lệ</h1>
      <p>Vui lòng mở một chuyến từ danh sách vận chuyển.</p>
      <Link className="trip-link" to={`/dashboard/trips${listSearch}`}>Về danh sách chuyến</Link>
    </div>;
  }

  // Error handling per section 10.2
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined;

  if (query.isPending) {
    return (
      <>
        <Link className="trip-back" to={`/dashboard/trips${listSearch}`}>← Danh sách chuyến</Link>
        <div className="trip-detail-loading" role="status" aria-label="Đang tải chi tiết chuyến">
          <span className="trip-sr-only">Đang tải chi tiết chuyến…</span>
          {[0, 1, 2].map(i => <div key={i} className="trip-skeleton-block" aria-hidden="true" />)}
        </div>
      </>
    );
  }

  if (query.isError) {
    const errorMessage =
      status === 400 ? 'ID chuyến hoặc yêu cầu không hợp lệ. Vui lòng mở lại từ danh sách.' :
      status === 403 ? 'Bạn không có quyền xem chuyến này.' :
      status === 404 ? 'Chuyến không tồn tại hoặc bạn không có quyền truy cập.' :
      'Không tải được thông tin chuyến. Vui lòng thử lại.';

    return (
      <>
        <Link className="trip-back" to={`/dashboard/trips${listSearch}`}>← Danh sách chuyến</Link>
        <div className="trip-detail-error" role="alert">
          <h2>Không thể hiển thị chuyến</h2>
          <p>{errorMessage}</p>
          {status !== 400 && status !== 403 && status !== 404 && (
            <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
              Thử lại
            </button>
          )}
          <Link className="trip-link" to={`/dashboard/trips${listSearch}`}>Về danh sách chuyến</Link>
        </div>
      </>
    );
  }

  if (!trip) return null;

  const hasReturnReason = trip.planStatus === 'DRAFT' && !!trip.returnReason;
  async function review(input:{decision:'APPROVED'}|{decision:'RETURNED';reason:string}) { if(account?.role!=='MANAGER'||!tripId)return; setReviewing(true); try { const saved=await reviewTripPlan(tripId,input); qc.setQueryData(tripQueryKeys.detail(account.id,tripId),saved); qc.invalidateQueries({queryKey:['trips',account.id,'list']}); setReviewOpen(false); void messageApi.success({key:'trip-review-feedback',content:input.decision==='APPROVED'?'Đã duyệt kế hoạch chuyến đi.':'Đã trả lại kế hoạch để chỉnh sửa.'}); } catch(e) { void messageApi.error({key:'trip-review-feedback',content:String(isAxiosError(e)?(e.response?.data?.message||'Không thể cập nhật kế hoạch.'):'Không thể cập nhật kế hoạch.'),duration:5}); } finally {setReviewing(false); } }

  return (
    <>
      <Link className="trip-back" to={`/dashboard/trips${listSearch}`}>← Danh sách chuyến</Link>

      <header className="trip-heading">
        <p className="trip-eyebrow">QUY TRÌNH 03 · CHI TIẾT CHUYẾN</p>
        <h1>Chuyến #{trip.id} · Đơn {trip.orderCode}</h1>
        <div className="trip-status-row">
          <span>Kế hoạch: <TripStatusBadge status={trip.planStatus} hasReturnReason={hasReturnReason} /></span>
          <span>Đơn: <OrderStatusBadge status={trip.orderStatus} /></span>
        </div>
      </header>

      {/* Return reason banner — shown near top per section 4.2 */}
      {hasReturnReason && (
        <div className="trip-return-banner" role="alert">
          <strong>Kế hoạch đã bị trả lại.</strong>
          <p>Lý do: {trip.returnReason}</p>
        </div>
      )}

      {/* Refetch indicator for background updates */}
      {query.isFetching && (
        <p className="trip-sr-only" role="status">Đang cập nhật thông tin chuyến…</p>
      )}

      <TripDetailTabs activeTab={activeTab} onTabChange={setTab} />
      {account?.role==='MANAGER'&&trip.planStatus==='PENDING_APPROVAL'&&activeTab==='plan'&&<div className="trip-review-actions"><button type="button" onClick={()=>setReviewOpen(true)}>Duyệt kế hoạch</button><button type="button" onClick={()=>setReviewOpen(true)}>Trả lại chỉnh sửa</button></div>}
      <TripReviewDialog open={reviewOpen} pending={reviewing} onClose={()=>setReviewOpen(false)} onSubmit={review} />

      <div className="trip-detail-grid">
        <section
          className="trip-panel"
          id={`trip-tabpanel-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`trip-tab-${activeTab}`}
        >
          {activeTab === 'plan' && (
            <>
              <div className="trip-panel-header">
                <h2>Kế hoạch hành trình</h2>
                <div className="trip-panel-header-actions">
                  {trip.legs.length > 0 && (
                    <span className="trip-count">{trip.legs.length} chặng</span>
                  )}
                  {account?.role === 'COORDINATOR' && trip.planStatus === 'DRAFT' && ['APPROVED', 'PREPARING'].includes(trip.orderStatus) && (
                    <Link className="trip-action-button" to={`/coordinator/trips/${trip.id}`}>
                      {trip.legs.length > 0 ? 'Chỉnh sửa kế hoạch' : 'Lập kế hoạch'}
                    </Link>
                  )}
                </div>
              </div>
              <p className="trip-timezone">Thời gian hiển thị: Asia/Ho_Chi_Minh (UTC+07:00).</p>
              {trip.routePlan && <TripRoutePlanSummary routePlan={trip.routePlan} />}
              <TripLegTimeline legs={trip.legs} />

            </>
          )}

          {activeTab === 'crew' && (
            <TripAssignmentsPanel trip={trip} />
          )}
          {false && (
            <div className="trip-placeholder">
              <span className="trip-placeholder-icon" aria-hidden="true">◇</span>
              <span className="trip-label">Sắp ra mắt</span>
              <h2>Phân công nhân sự</h2>
              <p>
                Khu vực phân công tài xế và người hộ tống đang được chuẩn bị.
                Bạn chưa thể xem hoặc chỉnh sửa nhân sự tại đây.
              </p>
            </div>
          )}

        </section>

        <aside className="trip-panel trip-summary-aside" aria-labelledby="trip-summary-title">
          <h2 id="trip-summary-title">Tóm tắt chuyến</h2>
          <TripSummary trip={trip} />
        </aside>
      </div>
    </>
  );
}
