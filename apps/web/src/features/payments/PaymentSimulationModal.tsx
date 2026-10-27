import {useFeedback} from '../../components/useFeedback';
import { useState, useEffect } from 'react';
import { Modal, Tabs, Button, Alert, Spin, Result } from 'antd';
import { CopyOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { api } from '../../lib/axios';
import './payment-simulation.css';

export interface PaymentSimulationModalProps {
  open: boolean;
  orderId: string;
  orderCode?: string;
  paymentType: 'DEPOSIT' | 'BALANCE';
  amount: number;
  onClose: () => void;
  onSuccess: (resultData: any) => void;
}

const money = (v: number) => Number(v || 0).toLocaleString('vi-VN') + ' đ';

export default function PaymentSimulationModal({
  open,
  orderId,
  orderCode,
  paymentType,
  amount,
  onClose,
  onSuccess,
}: PaymentSimulationModalProps) {
  const {message}=useFeedback();
  const [walletOpen, setWalletOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'E_WALLET' | 'CARD'>('BANK_TRANSFER');
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<'SUCCESS' | 'FAILED' | 'CANCELLED' | null>(null);

  // Initialize or fetch payment session when modal opens or method changes
  useEffect(() => {
    if (!open) {
      setWalletOpen(false);
      setSessionData(null);
      setError('');
      setResult(null);
      return;
    }

    let active = true;
    const initSession = async () => {
      setLoading(true);
      setSessionData(null);
      setError('');
      try {
        const res = await api.post('/payments/sessions', {
          orderId,
          paymentType,
          paymentMethod: method,
        });
        if (active) {
          setSessionData(res.data);
        }
      } catch (err: any) {
        if (active) {
          setError(err.response?.data?.message || 'Không thể tạo phiên thanh toán giả lập.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void initSession();

    return () => {
      active = false;
    };
  }, [open, orderId, paymentType, method, attempt]);

  const handleSimulate = async (actionResult: 'SUCCESS' | 'FAILED' | 'CANCELLED') => {
    if (!sessionData?.sessionCode || actionBusy) return;

    setActionBusy(true);
    try {
      const res = await api.post(`/payments/sessions/${sessionData.sessionCode}/complete`, {
        result: actionResult,
        failureReason: actionResult === 'FAILED' ? 'Thử nghiệm thất bại (mô phỏng)' : undefined,
      });

      setWalletOpen(false);
      setResult(actionResult);

      if (actionResult === 'SUCCESS') {
        void message.success('Thanh toán mô phỏng thành công!');
        onSuccess(res.data);
      } else if (actionResult === 'FAILED') {
        void message.error('Thanh toán mô phỏng thất bại.');
      } else {
        void message.info('Đã hủy phiên thanh toán.');
      }
    } catch (err: any) {
      void message.error(err.response?.data?.message || 'Có lỗi khi xử lý kết quả thanh toán.');
    } finally {
      setActionBusy(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    void message.success(`Đã sao chép ${label}!`);
  };

  const typeLabel = paymentType === 'DEPOSIT' ? 'Đặt cọc' : 'Thanh toán phần còn lại';

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!actionBusy) onClose();
      }}
      footer={null}
      width={560}
      centered
      destroyOnClose
      className="psm-modal"
    >
      <div className="psm-header">
        <div className="psm-notice">
          <ExclamationCircleOutlined />
          <span>Thanh toán mô phỏng — không thu tiền thật</span>
        </div>
        <div className="psm-order-info">
          <div>
            <span style={{ fontSize: 13, color: '#64748b' }}>{typeLabel} cho đơn</span>
            <div className="psm-order-code">{orderCode || `#${orderId}`}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Số tiền cần thanh toán</span>
            <div className="psm-amount">{money(sessionData?.amount || amount)}</div>
          </div>
        </div>
      </div>

      <div className="psm-body">
        {result ? (
          <div className="psm-result-box">
            {result === 'SUCCESS' && (
              <Result
                status="success"
                title="Thanh toán thành công (Mô phỏng)"
                subTitle={`Hệ thống đã ghi nhận khoản tiền ${money(sessionData?.amount || amount)} vào lịch sử thanh toán của đơn hàng.`}
                extra={[
                  <Button type="primary" key="close" onClick={onClose}>
                    Đóng
                  </Button>,
                ]}
              />
            )}
            {result === 'FAILED' && (
              <Result
                status="error"
                title="Thanh toán thất bại (Mô phỏng)"
                subTitle="Mô phỏng giao dịch thanh toán không thành công. Bạn có thể chọn thử lại."
                extra={[
                  <Button key="retry" onClick={() => { setSessionData(null); setResult(null); setAttempt(n => n + 1); }}>
                    Thử lại
                  </Button>,
                  <Button key="close" onClick={onClose}>
                    Đóng
                  </Button>,
                ]}
              />
            )}
            {result === 'CANCELLED' && (
              <Result
                status="warning"
                title="Giao dịch đã hủy"
                subTitle="Bạn đã hủy phiên thanh toán mô phỏng."
                extra={[
                  <Button key="retry" onClick={() => { setSessionData(null); setResult(null); setAttempt(n => n + 1); }}>
                    Thực hiện lại
                  </Button>,
                  <Button key="close" onClick={onClose}>
                    Đóng
                  </Button>,
                ]}
              />
            )}
          </div>
        ) : walletOpen ? (
          <section className="psm-wallet-confirm" aria-label="Ví giả lập">
            <h2>Xác nhận thanh toán ví</h2>
            <p>Ví thử nghiệm · Không trừ tiền thật</p>
            <dl>
              <div><dt>Đơn hàng</dt><dd>{orderCode || '#'+orderId}</dd></div>
              <div><dt>Nội dung</dt><dd>{typeLabel}</dd></div>
              <div><dt>Mã phiên</dt><dd>{sessionData?.sessionCode}</dd></div>
              <div><dt>Số tiền</dt><dd className="psm-amount">{money(sessionData?.amount)}</dd></div>
            </dl>
            <Button className="psm-wallet-btn" block loading={actionBusy} onClick={()=>void handleSimulate('SUCCESS')}>Xác nhận thanh toán giả lập</Button>
            <div className="psm-wallet-secondary">
              <Button disabled={actionBusy} onClick={()=>setWalletOpen(false)}>Quay lại mã QR</Button>
              <Button danger disabled={actionBusy} onClick={()=>void handleSimulate('CANCELLED')}>Hủy giao dịch</Button>
            </div>
          </section>
        ) : (
          <Spin spinning={loading}>
            {error ? (
              <Alert type="error" message={error} style={{ margin: '16px 0' }} />
            ) : (
              <Tabs
                activeKey={method}
                onChange={(key) => { if (!actionBusy) { setSessionData(null); setMethod(key as any); } }}
                className="psm-tabs"
                items={[
                  {
                    key: 'BANK_TRANSFER',
                    label: 'Chuyển khoản QR',
                    children: (
                      <div className="psm-qr-container">
                        {sessionData?.bankDetails?.qrUrl ? (
                          <img
                            src={sessionData.bankDetails.qrUrl}
                            alt="VietQR Chuyển khoản"
                            className="psm-qr-image"
                          />
                        ) : (
                          <div style={{ padding: 40, color: '#94a3b8' }}>Đang tạo mã VietQR...</div>
                        )}
                        <div className="psm-bank-details">
                          <div className="psm-detail-row">
                            <span>Ngân hàng:</span>
                            <strong>{sessionData?.bankDetails?.bankName || 'MB Bank'}</strong>
                          </div>
                          <div className="psm-detail-row">
                            <span>Số tài khoản:</span>
                            <strong>
                              {sessionData?.bankDetails?.accountNumber || '0988889999'}
                              <Button
                                type="text"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() =>
                                  copyText(sessionData?.bankDetails?.accountNumber || '0988889999', 'Số tài khoản')
                                }
                              />
                            </strong>
                          </div>
                          <div className="psm-detail-row">
                            <span>Chủ tài khoản:</span>
                            <strong>{sessionData?.bankDetails?.accountHolder || 'CONG TY CP VAN CHUYEN NGUA VIET NAM'}</strong>
                          </div>
                          <div className="psm-detail-row">
                            <span>Nội dung chuyển khoản:</span>
                            <strong>
                              {sessionData?.bankDetails?.content || `CK ${orderCode || orderId}`}
                              <Button
                                type="text"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() =>
                                  copyText(sessionData?.bankDetails?.content || `CK ${orderCode || orderId}`, 'Nội dung CK')
                                }
                              />
                            </strong>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'E_WALLET',
                    label: 'Ví điện tử',
                    children: (
                      <div className="psm-wallet-pane">
                        <div className="psm-qr-container" style={{ width: '100%' }}>
                          {sessionData?.walletDetails?.qrUrl ? (
                            <img
                              src={sessionData.walletDetails.qrUrl}
                              alt="Ví điện tử QR"
                              className="psm-qr-image"
                            />
                          ) : (
                            <div style={{ padding: 40, color: '#94a3b8' }}>Đang tạo QR ví...</div>
                          )}
                          <p style={{ marginTop: 12, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                            Quét mã bằng ứng dụng ví MoMo hoặc VNPay (mô phỏng)
                          </p>
                        </div>
                        <Button
                          className="psm-wallet-btn"
                          block
                          disabled={loading || actionBusy || !sessionData || sessionData.paymentMethod !== 'E_WALLET'}
                          onClick={() => setWalletOpen(true)}
                        >
                          Mở màn hình ví giả lập
                        </Button>
                      </div>
                    ),
                  },
                  {
                    key: 'CARD',
                    label: 'Thẻ quốc tế',
                    children: (
                      <div>
                        <div className="psm-card-preview">
                          <div className="psm-card-top">
                            <span>VISA / MASTERCARD</span>
                            <span>TEST CARD</span>
                          </div>
                          <div className="psm-card-number">
                            {sessionData?.cardDetails?.cardNumber || '4532 •••• •••• 8899'}
                          </div>
                          <div className="psm-card-bottom">
                            <div>
                              <small>CHỦ THẺ</small>
                              <span>{sessionData?.cardDetails?.cardHolder || 'NGUYEN VAN A'}</span>
                            </div>
                            <div>
                              <small>HẾT HẠN</small>
                              <span>{sessionData?.cardDetails?.expiry || '12/28'}</span>
                            </div>
                            <div>
                              <small>CVV</small>
                              <span>{sessionData?.cardDetails?.cvv || '888'}</span>
                            </div>
                          </div>
                        </div>
                        <p className="psm-card-notice">
                          {sessionData?.cardDetails?.mockNotice ||
                            'Thông tin thẻ thử nghiệm mô phỏng. Không yêu cầu nhập thẻ thật.'}
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Spin>
        )}
      </div>

      {!result && !error && !walletOpen && (
        <div className="psm-actions-panel">
          <div className="psm-action-title">Chọn kết quả giả lập để hệ thống ghi nhận và kiểm tra:</div>
          <div className="psm-buttons-row">
            <Button
              className="psm-btn-success"
              icon={<CheckCircleOutlined />}
              loading={actionBusy}
              disabled={loading || !sessionData}
              onClick={() => handleSimulate('SUCCESS')}
            >
              Thành công
            </Button>
            <Button
              className="psm-btn-fail"
              icon={<CloseCircleOutlined />}
              loading={actionBusy}
              disabled={loading || !sessionData}
              onClick={() => handleSimulate('FAILED')}
            >
              Thất bại
            </Button>
            <Button
              loading={actionBusy}
              disabled={loading || !sessionData}
              onClick={() => handleSimulate('CANCELLED')}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

