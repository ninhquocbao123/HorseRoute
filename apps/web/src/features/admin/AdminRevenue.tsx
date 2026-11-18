import { useEffect, useState } from 'react';
import { Alert, Button, Empty, InputNumber, Select, Spin } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../lib/axios';
import { useOrderSocket } from '../../lib/socket';

const money = (n: number | string) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

const compactMoney = (value: number | string) => {
  const n = Number(value || 0);
  return n >= 1e9
    ? (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ đ'
    : n >= 1e6
    ? (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr đ'
    : money(n);
};

const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('vi-VN') : '—');

type Row = Record<string, any>;

export default function AdminRevenue({ report }: { report?: (e: any) => void }) {
  const [revision, setRevision] = useState(0);

  useOrderSocket(undefined, {
    onPaymentUpdate: () => setRevision(n => n + 1),
    onStatusUpdate: () => setRevision(n => n + 1),
    onReconnect: () => setRevision(n => n + 1),
  });

  useEffect(() => {
    const refresh = () => setRevision(n => n + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1);
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);

    const fetchRevenue = async () => {
      try {
        const res = await api.get('/admin/revenue', { params: { year, month } });
        return res.data;
      } catch (err: any) {
        if (err.response?.status === 404) {
          const res = await api.get('/manager/revenue', { params: { year, month } });
          return res.data;
        }
        throw err;
      }
    };

    fetchRevenue()
      .then(resData => {
        if (active) {
          setData(resData);
          setError('');
        }
      })
      .catch(e => {
        if (active) {
          const msg =
            e.response?.data?.message ||
            (e.response?.status === 403
              ? 'Chưa được cấp quyền xem doanh thu hoặc máy chủ API chưa khởi động lại.'
              : 'Không tải được báo cáo doanh thu.');
          setError(msg);
          report?.(e);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [year, month, revision, report]);

  function exportCsv() {
    if (!data) return;
    const escape = (v: any) =>
      '"' + String(v ?? '').replace(/^[=+@\-]/, "'$&").split('"').join('""') + '"';

    const rows = [
      ['Mã đơn', 'Hoàn tất & thanh toán đủ', 'Khách hàng', 'Tuyến đường', 'Loại', 'Doanh thu (VND)'],
      ...data.items.map((r: Row) => [
        r.order_code,
        date(r.completed_at),
        r.customer_name,
        r.origin_address + ' → ' + r.destination_address,
        r.origin_country === r.destination_country ? 'Trong nước' : 'Quốc tế',
        r.total,
      ]),
    ];

    const url = URL.createObjectURL(
      new Blob(['\ufeff' + rows.map(r => r.map(escape).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `doanh-thu-${year}-${month ? `thang-${month}` : 'ca-nam'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const max = Math.max(1, ...(data?.months || []).map((m: Row) => m.total));

  return (
    <div>
      {/* Filter and Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="adm-filter" style={{ marginBottom: 0 }}>
          <button
            className={month ? 'active' : ''}
            onClick={() => setMonth(new Date().getMonth() + 1)}
          >
            Xem theo tháng
          </button>
          <button
            className={!month ? 'active' : ''}
            onClick={() => setMonth(undefined)}
          >
            Xem cả năm
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <InputNumber
            aria-label="Năm báo cáo"
            min={2020}
            max={2100}
            precision={0}
            value={year}
            style={{ width: 100, height: 40 }}
            onChange={v => setYear(v || new Date().getFullYear())}
          />

          {month && (
            <Select
              aria-label="Tháng báo cáo"
              value={month}
              style={{ width: 120, height: 40 }}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: i + 1,
                label: 'Tháng ' + (i + 1),
              }))}
              onChange={setMonth}
            />
          )}

          <Button
            icon={<DownloadOutlined />}
            style={{ height: 40, borderRadius: 10, fontWeight: 600 }}
            disabled={!data || !data.items?.length}
            onClick={exportCsv}
          >
            Xuất Excel (CSV)
          </Button>

          <Button
            icon={<ReloadOutlined />}
            style={{ height: 40, borderRadius: 10 }}
            onClick={() => setRevision(n => n + 1)}
            disabled={loading}
          />
        </div>
      </div>

      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        💡 <strong>Giải thích số liệu:</strong> Tiền đã thu tính theo tháng/năm đang chọn. Còn phải thu là số dư công nợ hiện tại của tất cả đơn hợp lệ. Doanh thu hoàn tất chỉ ghi nhận đối với các chuyến đã giao ngựa an toàn và hoàn tất 100% thanh toán.
      </p>

      <Spin spinning={loading}>
        {/* KPI Summary Cards */}
        <div className="adm-stats">
          <article>
            <span>
              TIỀN ĐÃ THU TRONG KỲ
              <i>💰</i>
            </span>
            <strong>{data ? money(data.collected || 0) : '—'}</strong>
            <small>Tiền cọc và thanh toán theo ngày nhận tiền</small>
          </article>

          <article>
            <span>
              CÒN PHẢI THU (CÔNG NỢ)
              <i>⏳</i>
            </span>
            <strong style={{ color: (data?.outstanding || 0) > 0 ? '#b88b18' : undefined }}>
              {data ? money(data.outstanding || 0) : '—'}
            </strong>
            <small>Tất cả đơn có báo giá, trừ đơn hủy</small>
          </article>

          <article>
            <span>
              DOANH THU {month ? `THÁNG ${month}` : `NĂM ${year}`}
              <i>📈</i>
            </span>
            <strong>{data ? compactMoney(data.total) : '—'}</strong>
            <small>{data?.count || 0} chuyến giao thành công</small>
          </article>

          <article>
            <span>
              LŨY KẾ CẢ NĂM {year}
              <i>🏆</i>
            </span>
            <strong>{data ? compactMoney(data.yearTotal) : '—'}</strong>
            <small>TB: {data ? compactMoney(data.average) : '—'} / chuyến</small>
          </article>
        </div>

        {/* Charts & Breakdown (2 columns) */}
        <div className="adm-grid-2col" style={{ marginBottom: 24 }}>
          {/* Monthly Bar Chart */}
          <section className="adm-card">
            <h3>Doanh thu hoàn tất theo tháng · Năm {year}</h3>
            <small style={{ color: 'var(--muted)', display: 'block', margin: '-8px 0 16px' }}>
              Đơn vị: {max >= 1e9 ? 'tỷ đồng' : max >= 1e6 ? 'triệu đồng' : 'đồng'} · {month ? 'Cột màu vàng là tháng đang chọn' : 'Cả năm'}
            </small>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                height: 240,
                paddingTop: 30,
              }}
              role="img"
              aria-label="Biểu đồ doanh thu theo tháng"
            >
              {(data?.months || []).map((m: Row) => (
                <div
                  key={m.month}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                    gap: 6,
                  }}
                >
                  <small style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {m.total
                      ? (m.total / (max >= 1e9 ? 1e9 : max >= 1e6 ? 1e6 : 1)).toLocaleString('vi-VN', {
                          maximumFractionDigits: 1,
                        })
                      : '—'}
                  </small>
                  <i
                    style={{
                      display: 'block',
                      width: '100%',
                      maxWidth: 38,
                      borderRadius: '6px 6px 0 0',
                      height: Math.max((m.total / max) * 160, 4),
                      background: m.month === month ? '#f4bf42' : '#125e67',
                      transition: 'height 0.3s',
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>T{m.month}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Breakdown & Top Routes */}
          <section className="adm-card">
            <h3>Cơ cấu doanh thu</h3>
            <div style={{ margin: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span>Trong nước</span>
                <b>{money(data?.domestic || 0)}</b>
              </div>
              <progress
                style={{ width: '100%', height: 8, accentColor: '#125e67' }}
                max={data?.total || 1}
                value={data?.domestic || 0}
              />
            </div>

            <div style={{ margin: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span>Quốc tế</span>
                <b>{money(data?.international || 0)}</b>
              </div>
              <progress
                style={{ width: '100%', height: 8, accentColor: '#f4bf42' }}
                max={data?.total || 1}
                value={data?.international || 0}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 20, paddingTop: 14 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase' }}>
                Tuyến doanh thu cao nhất
              </h4>
              {Object.entries(
                (data?.items || []).reduce((out: Record<string, number>, r: Row) => {
                  const key = r.origin_address + ' → ' + r.destination_address;
                  out[key] = (out[key] || 0) + Number(r.total);
                  return out;
                }, {})
              )
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 3)
                .map(([route, totalSum]) => (
                  <p
                    key={route}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      margin: '8px 0',
                      gap: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {route}
                    </span>
                    <b style={{ whiteSpace: 'nowrap' }}>{compactMoney(Number(totalSum))}</b>
                  </p>
                ))}
              {(!data?.items || !data.items.length) && (
                <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chưa có đơn trong kỳ này.</p>
              )}
            </div>
          </section>
        </div>

        {/* Detailed Orders Table */}
        <section className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3>Lịch sử chuyến hoàn thành · {month ? `Tháng ${month}/` : ''}{year}</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Tổng cộng: <strong>{data?.count || 0}</strong> đơn
            </span>
          </div>

          <div className="adm-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>MÃ ĐƠN</th>
                  <th style={{ width: '15%' }}>HOÀN TẤT</th>
                  <th style={{ width: '20%' }}>KHÁCH HÀNG</th>
                  <th style={{ width: '28%' }}>LỘ TRÌNH</th>
                  <th style={{ width: '10%' }}>LOẠI</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>DOANH THU</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((r: Row) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.order_code}</b>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {date(r.completed_at)}
                      </span>
                    </td>
                    <td>{r.customer_name}</td>
                    <td>
                      <span style={{ fontSize: 11 }}>
                        {r.origin_address} → {r.destination_address}
                      </span>
                    </td>
                    <td>
                      <span className={`adm-badge ${r.origin_country === r.destination_country ? 'adm-badge-active' : 'adm-badge-pending'}`}>
                        {r.origin_country === r.destination_country ? 'Trong nước' : 'Quốc tế'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {money(r.total)}
                    </td>
                  </tr>
                ))}

                {data && !data.items?.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px' }}>
                      <Empty description="Chưa có đơn đã giao và thanh toán đủ trong kỳ" />
                    </td>
                  </tr>
                )}
              </tbody>
              {data && data.items?.length > 0 && (
                <tfoot>
                  <tr>
                    <th colSpan={5} style={{ background: '#f6faf9', fontSize: 12 }}>
                      Tổng doanh thu hoàn tất
                    </th>
                    <th style={{ textAlign: 'right', background: '#f6faf9', fontSize: 13, color: '#103e46' }}>
                      {money(data.total || 0)}
                    </th>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </Spin>
    </div>
  );
}
