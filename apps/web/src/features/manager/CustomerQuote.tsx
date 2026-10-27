import PaymentSimulationModal from '../payments/PaymentSimulationModal';
import { useEffect, useState, useCallback } from 'react';
import { Alert, Spin, Empty, Button, Tag } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { api } from '../../lib/axios';
import { useOrderSocket } from '../../lib/socket';


const money = (n: number | string) => Number(n || 0).toLocaleString('vi-VN') + '\u00A0đ';

const paymentMethods: Record<string, string> = {
  BANK_TRANSFER: 'Chuyển khoản QR',
  E_WALLET: 'Ví điện tử',
  CARD: 'Thẻ quốc tế',
  MANUAL: 'Thủ công',
  CASH: 'Tiền mặt',
};

const groups = [
  ['Vận chuyển', ['TRANSPORT', 'EXCESS_DISTANCE', 'CREW', 'FUEL']],
  ['Chăm sóc ngựa', ['WATER', 'EXTRA_STALL', 'FEED']],
  ['Thủ tục', ['INTERNATIONAL']],
  ['Bảo hiểm', ['INSURANCE']],
] as const;

export default function CustomerQuote({
  orderId,
  orderCode,
  orderStatus,
  onPaymentSuccess,
}: {
  orderId: string;
  orderCode?: string;
  orderStatus?: string;
  onPaymentSuccess?: (resultData: any) => void;
}) {
  const [paymentModalOpen,setPaymentModalOpen]=useState(false);
  const [paymentType,setPaymentType]=useState<'DEPOSIT'|'BALANCE'>('DEPOSIT');

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQuote = useCallback(() => {
    let active = true;
    setError(false);
    void api
      .get('/orders/' + orderId + '/quote')
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    return fetchQuote();
  }, [fetchQuote]);

  // Real-time updates via Socket.IO
  useOrderSocket(orderId, {
    onPaymentUpdate: (payload) => {
      if (payload.status === 'SUCCESS') {
        setData((prev: any) => (prev ? { ...prev, paid: payload.paid } : prev));
        fetchQuote();
        onPaymentSuccess?.(payload);
      }
    },
    onReconnect: () => {
      fetchQuote();
    },
  });

  const handleOpenDeposit = () => {
    setPaymentType('DEPOSIT');setPaymentModalOpen(true);
  };

  const handleOpenBalance = () => {
    setPaymentType('BALANCE');setPaymentModalOpen(true);
  };

  const paid = Number(data?.paid || 0);
  const total = Number(data?.total || 0);
  const deposit = Number(data?.deposit || 0);
  const isDepositPaid = paid >= deposit && deposit > 0;
  const isFullyPaid = paid >= total && total > 0;
  const remaining = Math.max(0, total - paid);
  const depositRemaining = Math.max(0, deposit - paid);

  const isRejected = orderStatus === 'REJECTED';

  return (
    <Spin spinning={loading}>
      <section className="cq-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Báo giá chính thức</h3>
          {isRejected && <Tag color="error">Đơn bị từ chối</Tag>}
          {!isRejected && isFullyPaid && (
            <Tag color="success" icon={<CheckCircleFilled />}>
              Đã thanh toán đủ
            </Tag>
          )}
          {!isRejected && !isFullyPaid && isDepositPaid && (
            <Tag color="processing">Đã đủ tiền cọc</Tag>
          )}
        </div>

        {error ? (
          <Alert type="error" message="Không tải được báo giá. Vui lòng mở lại đơn." />
        ) : data ? (
          <>
            <p className="cq-expiry">Hiệu lực đến {new Date(data.expires_at).toLocaleString('vi-VN')}</p>
            <div className="cq-total">
              <small>Tổng báo giá</small>
              <strong>{money(data.total)}</strong>
            </div>
            <div className="cq-distribution">
              {groups.map(([name, codes]) => {
                const sum = data.items
                  .filter((i: any) => (codes as readonly string[]).includes(i.code))
                  .reduce((v: number, i: any) => v + Number(i.amount), 0);
                return sum > 0 && <span key={name} title={name} style={{ flex: sum }} />;
              })}
            </div>
            {groups.map(([name, codes]) => {
              const rows = data.items.filter((i: any) => (codes as readonly string[]).includes(i.code));
              if (!rows.length) return null;
              const sum = rows.reduce((s: number, i: any) => s + Number(i.amount), 0);
              return (
                <section className="cq-group" key={name}>
                  <header>
                    <strong>{name}</strong>
                    <small>{Number(data.subtotal) > 0 ? Math.round((sum / Number(data.subtotal)) * 100) : 0}%</small>
                    <b>{money(sum)}</b>
                  </header>
                  {rows.map((i: any) => (
                    <div key={i.code}>
                      <span>{i.label}</span>
                      <b>{money(i.amount)}</b>
                    </div>
                  ))}
                  
      </section>
              );
            })}
            <dl className="cq-summary">
              {[
                ['Điều chỉnh', data.adjustment],
                ['VAT ' + Number(data.vat_percent) + '%', data.vat_amount],
                ['Đặt cọc ' + Number(data.deposit_percent) + '%', data.deposit],
                ['Đã thanh toán', paid],
                ['Còn lại', remaining],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{money(value)}</dd>
                </div>
              ))}
            </dl>
            {data.adjustment_reason && <p>{data.adjustment_reason}</p>}

            {/* Lịch sử các lần thanh toán đơn này */}
            {data.receipts && data.receipts.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                <strong style={{ fontSize: 13, color: '#0c3e47', display: 'block', marginBottom: 8 }}>
                  Lịch sử thanh toán đơn này ({data.receipts.length})
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.receipts.map((r: any) => (
                    <div
                      key={r.id}
                      style={{
                        padding: '8px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ color: '#059669', fontSize: 13 }}>+ {money(r.amount)}</b>
                        <Tag color="success" style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                          Thành công
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, color: '#64748b', fontSize: 11 }}>
                        <span>
                          <Tag style={{ margin: 0, fontSize: 11 }}>
                            {paymentMethods[r.method] || r.method || 'Chuyển khoản QR'}
                          </Tag>
                          <span style={{ marginLeft: 6 }}>{r.reference}</span>
                        </span>
                        <span>{new Date(r.received_at).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trạng thái từ chối hoặc nút thanh toán */}
            {isRejected ? (
              <Alert
                type="error"
                showIcon
                message="Đơn hàng đã bị từ chối"
                description="Hồ sơ vận chuyển bị chuyên viên từ chối. Đơn hàng không thể tiếp tục đặt cọc hay thanh toán."
                style={{ marginTop: 14 }}
              />
            ) : (
              <>
                {!isDepositPaid && (
                  <Button
                    className="cq-deposit"
                    block
                    onClick={handleOpenDeposit}
                  >
                    Đặt cọc {money(depositRemaining)}
                  </Button>
                )}

                {isDepositPaid && !isFullyPaid && (
                  <Button
                    className="cq-deposit cq-balance-btn"
                    block
                    style={{ background: '#0284c7', borderColor: '#0284c7', color: '#ffffff' }}
                    onClick={handleOpenBalance}
                  >
                    Thanh toán phần còn lại {money(remaining)}
                  </Button>
                )}

                {isFullyPaid && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '10px 14px',
                      borderRadius: 6,
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    ✓ Đơn hàng đã được thanh toán đầy đủ
                  </div>
                )}
              </>
            )}


          </>
        ) : (
          !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có báo giá chính thức" />
        )}
      {!isRejected&&<PaymentSimulationModal open={paymentModalOpen} orderId={orderId} orderCode={orderCode} paymentType={paymentType} amount={paymentType==='DEPOSIT'?depositRemaining:remaining} onClose={()=>setPaymentModalOpen(false)} onSuccess={result=>{fetchQuote();onPaymentSuccess?.(result);}}/>}
      </section>
    </Spin>
  );
}
