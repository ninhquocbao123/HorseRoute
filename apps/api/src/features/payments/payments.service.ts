import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/users.model';
import { Role } from '@my-project/shared';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { socketService } from '../../shared/socket/socket.service';
import { CreatePaymentSessionDto, CompletePaymentSessionDto } from './payments.validation';

export class PaymentsService {
  constructor(private readonly db: DataSource) {}

  async createSession(user: User, dto: CreatePaymentSessionDto) {
    const [order] = await this.db.query('SELECT * FROM orders WHERE id=?', [dto.orderId]);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');

    if (user.role === Role.CUSTOMER && String(order.customer_id) !== String(user.id)) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này.');
    }

    const [quote] = await this.db.query(
      "SELECT * FROM order_quotes WHERE order_id=? AND status='APPROVED' ORDER BY id DESC LIMIT 1",
      [dto.orderId]
    );
    if (!quote) throw new ConflictException('Đơn hàng chưa có báo giá được phê duyệt.');

    const [paidRow] = await this.db.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM order_receipts WHERE order_id=?',
      [dto.orderId]
    );

    const total = Number(quote.total);
    const paid = Number(paidRow.paid);
    const deposit = Number(quote.deposit);
    const balance = Math.max(0, total - paid);

    let amount = 0;
    if (dto.paymentType === 'DEPOSIT') {
      if (paid >= deposit) {
        throw new BadRequestException('Đơn hàng đã hoàn tất đặt cọc.');
      }
      amount = deposit - paid;
    } else {
      if (paid < deposit) {
        throw new BadRequestException('Đơn hàng cần hoàn tất đặt cọc trước khi thanh toán phần còn lại.');
      }
      if (balance <= 0) {
        throw new BadRequestException('Đơn hàng đã được thanh toán đầy đủ.');
      }
      amount = balance;
    }

    const rand = Math.floor(1000 + Math.random() * 9000);
    const sessionCode = `PAY-${order.order_code}-${Date.now().toString(36).toUpperCase()}-${rand}`;

    const insertResult = await this.db.query(
      `INSERT INTO payment_sessions (session_code, order_id, quote_id, customer_id, payment_type, payment_method, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [sessionCode, dto.orderId, quote.id, order.customer_id, dto.paymentType, dto.paymentMethod, amount]
    );

    const mockInfo = this.getMockPaymentDetails(dto.paymentMethod, order.order_code, amount, sessionCode);

    return {
      sessionId: String(insertResult.insertId),
      sessionCode,
      orderId: String(dto.orderId),
      orderCode: order.order_code,
      paymentType: dto.paymentType,
      paymentMethod: dto.paymentMethod,
      amount,
      total,
      paid,
      balance,
      deposit,
      ...mockInfo,
    };
  }

  async completeSession(user: User, sessionCode: string, dto: CompletePaymentSessionDto) {
    return this.db.transaction(async (m: EntityManager) => {
      const [session] = await m.query(
        'SELECT s.*, o.order_code, o.customer_id AS order_customer_id, o.status AS order_status FROM payment_sessions s JOIN orders o ON o.id=s.order_id WHERE s.session_code=? FOR UPDATE',
        [sessionCode]
      );

      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên thanh toán.');
      }

      if (user.role === Role.CUSTOMER && String(session.customer_id) !== String(user.id)) {
        throw new ForbiddenException('Bạn không sở hữu phiên thanh toán này.');
      }

      // Idempotency check: duplicate submissions must never charge twice
      if (session.status !== 'PENDING') {
        throw new ConflictException(`Phiên thanh toán đã được xử lý với kết quả "${session.status}". Không ghi nhận lại.`);
      }

      const amount = Number(session.amount);

      if (dto.result === 'FAILED' || dto.result === 'CANCELLED') {
        await m.query(
          `UPDATE payment_sessions SET status=?, failure_reason=?, completed_at=UTC_TIMESTAMP(3) WHERE id=?`,
          [dto.result, dto.failureReason || (dto.result === 'CANCELLED' ? 'Khách hàng hủy giao dịch' : 'Mô phỏng thanh toán thất bại'), session.id]
        );

        const [paidRow] = await m.query(
          'SELECT COALESCE(SUM(amount), 0) AS paid FROM order_receipts WHERE order_id=?',
          [session.order_id]
        );
        const [quote] = await m.query('SELECT total FROM order_quotes WHERE id=?', [session.quote_id]);
        const total = Number(quote?.total || 0);
        const paid = Number(paidRow?.paid || 0);

        socketService.notifyPayment({
          orderId: String(session.order_id),
          orderCode: session.order_code,
          customerId: String(session.customer_id),
          paymentType: session.payment_type,
          paymentMethod: session.payment_method,
          amount,
          status: dto.result,
          paid,
          total,
          balance: Math.max(0, total - paid),
          message: dto.result === 'CANCELLED' ? 'Giao dịch đã được hủy.' : 'Thanh toán mô phỏng không thành công.',
        });

        return {
          sessionCode,
          status: dto.result,
          orderId: String(session.order_id),
          amount,
          paid,
          total,
          balance: Math.max(0, total - paid),
        };
      }

      // Result is SUCCESS
      const [quote] = await m.query('SELECT * FROM order_quotes WHERE id=? FOR UPDATE', [session.quote_id]);
      if (!quote || quote.status !== 'APPROVED') {
        throw new ConflictException('Báo giá không còn hiệu lực.');
      }

      const [paidRow] = await m.query(
        'SELECT COALESCE(SUM(amount), 0) AS paid FROM order_receipts WHERE order_id=? FOR UPDATE',
        [session.order_id]
      );
      const paidBefore = Number(paidRow.paid);
      const total = Number(quote.total);
      const deposit = Number(quote.deposit);

      if (paidBefore + amount > total) {
        throw new BadRequestException('Số tiền thanh toán vượt quá số dư cần trả.');
      }

      const reference = `SIM-${session.session_code}`;
      const [dup] = await m.query('SELECT id FROM order_receipts WHERE reference=?', [reference]);
      if (dup) {
        throw new ConflictException('Giao dịch đã được ghi nhận trước đó.');
      }

      // Mark session SUCCESS
      await m.query(
        `UPDATE payment_sessions SET status='SUCCESS', completed_at=UTC_TIMESTAMP(3) WHERE id=?`,
        [session.id]
      );

      // Insert order receipt
      await m.query(
        `INSERT INTO order_receipts (order_id, quote_id, amount, method, source, session_id, reference, received_at, recorded_by)
         VALUES (?, ?, ?, ?, 'ONLINE_SIMULATION', ?, ?, UTC_TIMESTAMP(3), ?)`,
        [session.order_id, session.quote_id, amount, session.payment_method, session.id, reference, user.id]
      );

      const newPaid = paidBefore + amount;
      const newBalance = Math.max(0, total - newPaid);

      // Check order status updates:
      // If paid >= deposit and current order is APPROVED, advance to PREPARING
      let nextOrderStatus = session.order_status;
      if (session.order_status === 'APPROVED' && newPaid >= deposit) {
        nextOrderStatus = 'PREPARING';
        await m.query("UPDATE orders SET status='PREPARING' WHERE id=? AND status='APPROVED'", [session.order_id]);
        await m.query(
          "INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, new_value, reason) VALUES (?, 'ORDER', ?, 'STATUS_CHANGE', ?, ?)",
          [user.id, session.order_id, JSON.stringify({ status: 'PREPARING', trigger: 'DEPOSIT_PAID', paid: newPaid }), 'Đã đủ tiền đặt cọc, chuyển sang chuẩn bị chuyến']
        );
      }

      if (newPaid >= total) {
        await m.query(
          "INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, new_value, reason) VALUES (?, 'ORDER', ?, 'FULLY_PAID', ?, ?)",
          [user.id, session.order_id, JSON.stringify({ paid: newPaid, total }), 'Đã thanh toán đủ toàn bộ chi phí vận chuyển']
        );
      }

      // Record audit for receipt
      await m.query(
        "INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, new_value, reason) VALUES (?, 'RECEIPT', ?, 'SIMULATION_PAYMENT', ?, ?)",
        [user.id, session.order_id, JSON.stringify({ sessionCode, amount, method: session.payment_method, type: session.payment_type }), 'Khách thanh toán trực tuyến mô phỏng']
      );

      // In-app notifications for Manager and Customer
      const managers = await m.query("SELECT id FROM users WHERE role='MANAGER' AND account_status='ACTIVE'");
      const paymentLabel = session.payment_type === 'DEPOSIT' ? 'đặt cọc' : 'thanh toán phần còn lại';
      const notifContent = `Đơn ${session.order_code} vừa được ${paymentLabel} thành công: ${amount.toLocaleString('vi-VN')} đ (Mô phỏng).`;

      for (const mgr of managers) {
        await m.query(
          "INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel) VALUES (?, 'PAYMENT_RECEIVED', ?, 'ORDER', ?, 'IN_APP')",
          [mgr.id, notifContent, session.order_id]
        );
      }

      await m.query(
        "INSERT INTO notifications (recipient_id, event_type, content, related_type, related_id, channel) VALUES (?, 'PAYMENT_SUCCESS', ?, 'ORDER', ?, 'IN_APP')",
        [session.customer_id, `Bạn đã ${paymentLabel} thành công ${amount.toLocaleString('vi-VN')} đ cho đơn ${session.order_code}.`, session.order_id]
      );

      // Broadcast WebSocket
      socketService.notifyPayment({
        orderId: String(session.order_id),
        orderCode: session.order_code,
        customerId: String(session.customer_id),
        paymentType: session.payment_type,
        paymentMethod: session.payment_method,
        amount,
        status: 'SUCCESS',
        paid: newPaid,
        total,
        balance: newBalance,
        orderStatus: nextOrderStatus,
        message: 'Thanh toán thành công.',
      });

      return {
        sessionCode,
        status: 'SUCCESS',
        orderId: String(session.order_id),
        orderCode: session.order_code,
        amount,
        paid: newPaid,
        total,
        balance: newBalance,
        orderStatus: nextOrderStatus,
      };
    });
  }

  async getSession(user: User, sessionCode: string) {
    const [session] = await this.db.query(
      `SELECT s.*, o.order_code, q.total, q.deposit
       FROM payment_sessions s
       JOIN orders o ON o.id=s.order_id
       JOIN order_quotes q ON q.id=s.quote_id
       WHERE s.session_code=?`,
      [sessionCode]
    );

    if (!session) throw new NotFoundException('Không tìm thấy phiên thanh toán.');

    if (user.role === Role.CUSTOMER && String(session.customer_id) !== String(user.id)) {
      throw new ForbiddenException('Bạn không sở hữu phiên thanh toán này.');
    }

    const mockInfo = this.getMockPaymentDetails(
      session.payment_method,
      session.order_code,
      Number(session.amount),
      session.session_code
    );

    return {
      sessionCode: session.session_code,
      orderId: String(session.order_id),
      orderCode: session.order_code,
      paymentType: session.payment_type,
      paymentMethod: session.payment_method,
      amount: Number(session.amount),
      status: session.status,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      failureReason: session.failure_reason,
      ...mockInfo,
    };
  }

  async getOrderPayments(user: User, orderId: string) {
    const [order] = await this.db.query('SELECT * FROM orders WHERE id=?', [orderId]);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');

    if (user.role === Role.CUSTOMER && String(order.customer_id) !== String(user.id)) {
      throw new ForbiddenException('Bạn không sở hữu đơn hàng này.');
    }

    const [quote] = await this.db.query(
      "SELECT id, total, deposit, deposit_percent, expires_at FROM order_quotes WHERE order_id=? AND status='APPROVED' ORDER BY id DESC LIMIT 1",
      [orderId]
    );

    const receipts = await this.db.query(
      `SELECT r.id, r.amount, r.reference, r.method, r.source, r.received_at, u.full_name AS recorder_name
       FROM order_receipts r
       LEFT JOIN users u ON u.id=r.recorded_by
       WHERE r.order_id=?
       ORDER BY r.received_at DESC, r.id DESC`,
      [orderId]
    );

    const total = quote ? Number(quote.total) : 0;
    const deposit = quote ? Number(quote.deposit) : 0;
    const paid = receipts.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
    const balance = Math.max(0, total - paid);

    return {
      orderId: String(orderId),
      orderCode: order.order_code,
      orderStatus: order.status,
      quote: quote ? { ...quote, total, deposit } : null,
      total,
      deposit,
      paid,
      balance,
      isDepositPaid: paid >= deposit && deposit > 0,
      isFullyPaid: paid >= total && total > 0,
      receipts: receipts.map((r: any) => ({
        id: String(r.id),
        amount: Number(r.amount),
        reference: r.reference,
        method: r.method,
        source: r.source,
        receivedAt: r.received_at,
        recorderName: r.recorder_name,
      })),
    };
  }

  private getMockPaymentDetails(method: string, orderCode: string, amount: number, sessionCode: string) {
    if (method === 'BANK_TRANSFER') {
      const content = `CK ${orderCode}`;
      const qrUrl = `https://img.vietqr.io/image/MB-0988889999-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
      return {
        bankDetails: {
          bankName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
          accountNumber: '0988889999',
          accountHolder: 'CONG TY CP VAN CHUYEN NGUA VIET NAM',
          content,
          qrUrl,
        },
      };
    }

    if (method === 'E_WALLET') {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`VNPAY_SIM_${orderCode}_${amount}`)}`;
      return {
        walletDetails: {
          provider: 'Ví điện tử (MoMo / VNPay mô phỏng)',
          qrUrl,
          openAppUrl: `vnd.vnpay://simulate?code=${sessionCode}`,
        },
      };
    }

    return {
      cardDetails: {
        cardNumber: '4532 •••• •••• 8899',
        cardHolder: 'NGUYEN VAN A',
        expiry: '12/28',
        cvv: '888',
        cardBrand: 'VISA / MASTERCARD',
        mockNotice: 'Thông tin thẻ thử nghiệm mô phỏng. Không yêu cầu nhập thẻ thật.',
      },
    };
  }
}

