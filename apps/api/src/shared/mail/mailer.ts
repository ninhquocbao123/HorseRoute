import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger.util';
const logger = new Logger('Mailer');

export type Mail = { to: string; subject: string; text: string };
export interface Mailer {
  /** Có gửi email thật không. Không có SMTP thì luồng xác minh email khi đăng ký tắt (xem emailVerificationEnabled). */
  readonly configured: boolean;
  send(mail: Mail): Promise<void>;
}

/**
 * Gửi email qua SMTP (mặc định Gmail: smtp.gmail.com:465 với mật khẩu ứng dụng). Cấu hình trong .env:
 *   SMTP_USER=hop-gui@gmail.com  SMTP_PASSWORD=<mật khẩu ứng dụng 16 ký tự>  (tùy chọn SMTP_HOST, SMTP_PORT, MAIL_FROM)
 * Thiếu SMTP_USER hoặc SMTP_PASSWORD: chỉ ghi email vào log khi không phải production, để thử luồng trên máy.
 */
export function createMailer(env: Record<string, string | undefined> = process.env): Mailer {
  const user = env.SMTP_USER?.trim(), pass = env.SMTP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) {
    return {
      configured: false,
      async send(mail) {
        if (env.NODE_ENV === 'production') throw new Error('MAIL_NOT_CONFIGURED');
        // Chỉ khi chạy trên máy: in nội dung để lấy mã thử, không bao giờ in ở production.
        logger.info('mail_dev_outbox', { to: mail.to, subject: mail.subject, text: mail.text });
      },
    };
  }
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, auth: { user, pass } });
  const from = env.MAIL_FROM?.trim() || `HorseRoute <${user}>`;
  return {
    configured: true,
    async send(mail) { await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text }); },
  };
}

/** EMAIL_VERIFICATION=true|false; không đặt thì bật khi đã cấu hình SMTP. */
export function emailVerificationEnabled(mailer: Mailer, env: Record<string, string | undefined> = process.env) {
  const value = env.EMAIL_VERIFICATION?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return mailer.configured;
}
