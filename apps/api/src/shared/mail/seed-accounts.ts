/**
 * Tài khoản mẫu do script seed tạo (apps/api/scripts/seed-flow4-demo.cjs, bảng ở doc/tai_khoan_demo.md).
 * Email dạng tên + @gmail.com có thể trùng hộp thư thật của người khác, nên hệ thống KHÔNG BAO GIỜ gửi email tới các địa chỉ này,
 * ở mọi môi trường (xác minh, quên mật khẩu, chào mừng). Mã xác minh, đặt lại mật khẩu chỉ ghi vào log khi không phải production.
 */
export type SeedAccount = {
  id: number;
  email: string;
  fullName: string;
  /** ADMIN, MANAGER, SPECIALIST, COORDINATOR, DRIVER, ESCORT, CUSTOMER. DRIVER và ESCORT là vai trò DRIVER_ESCORT kèm hồ sơ tổ lái. */
  kind: 'ADMIN' | 'MANAGER' | 'SPECIALIST' | 'COORDINATOR' | 'DRIVER' | 'ESCORT' | 'CUSTOMER';
  phone: string;
  address: string;
  customerType?: 'CLUB' | 'INDIVIDUAL';
  organizationName?: string;
  /** Tổ lái: số giấy phép lái xe (12 chữ số), hạng, ngày hết hạn. */
  license?: { number: string; class: string; expiresOn: string };
};

export const SEED_ACCOUNTS: SeedAccount[] = [
  { id: 1, email: 'tranquocbao.admin@gmail.com', fullName: 'Trần Quốc Bảo', kind: 'ADMIN', phone: '0903112233', address: '25 Lê Duẩn, Phường Sài Gòn, TP. Hồ Chí Minh' },
  { id: 2, email: 'lethiminhchau.manager@gmail.com', fullName: 'Lê Thị Minh Châu', kind: 'MANAGER', phone: '0908223344', address: '25 Lê Duẩn, Phường Sài Gòn, TP. Hồ Chí Minh' },
  { id: 3, email: 'nguyenthanhha.specialist@gmail.com', fullName: 'Nguyễn Thanh Hà', kind: 'SPECIALIST', phone: '0912334455', address: '25 Lê Duẩn, Phường Sài Gòn, TP. Hồ Chí Minh' },
  { id: 4, email: 'dangthutrang.coordinator@gmail.com', fullName: 'Đặng Thu Trang', kind: 'COORDINATOR', phone: '0917445566', address: '25 Lê Duẩn, Phường Sài Gòn, TP. Hồ Chí Minh' },
  { id: 5, email: 'nguyenvanhung.driver@gmail.com', fullName: 'Nguyễn Văn Hùng', kind: 'DRIVER', phone: '0938556677', address: 'Ấp 3, Xã Tân Thạnh Đông, Huyện Củ Chi, TP. Hồ Chí Minh', license: { number: '790187006512', class: 'FC', expiresOn: '2031-06-15' } },
  { id: 6, email: 'phamthilan.escort@gmail.com', fullName: 'Phạm Thị Lan', kind: 'ESCORT', phone: '0945667788', address: 'Phường Tân An, Tỉnh Tây Ninh' },
  { id: 7, email: 'vohoanglong.customer@gmail.com', fullName: 'Võ Hoàng Long', kind: 'CUSTOMER', phone: '0909778899', address: 'Khu chuồng ngựa Đức Hòa, Xã Đức Hòa, Tỉnh Tây Ninh', customerType: 'CLUB', organizationName: 'Câu lạc bộ Đua ngựa Phú Thọ' },
  { id: 8, email: 'buithingocanh.customer@gmail.com', fullName: 'Bùi Thị Ngọc Ánh', kind: 'CUSTOMER', phone: '0973889900', address: 'Trang trại Gò Dầu, Xã Gò Dầu, Tỉnh Tây Ninh', customerType: 'INDIVIDUAL' },
  { id: 11, email: 'tranminhtuan.driver@gmail.com', fullName: 'Trần Minh Tuấn', kind: 'DRIVER', phone: '0981990011', address: 'Phường Thủ Dầu Một, TP. Hồ Chí Minh', license: { number: '740192004387', class: 'C', expiresOn: '2029-11-30' } },
  { id: 12, email: 'huynhquocviet.coordinator@gmail.com', fullName: 'Huỳnh Quốc Việt', kind: 'COORDINATOR', phone: '0918001122', address: '25 Lê Duẩn, Phường Sài Gòn, TP. Hồ Chí Minh' },
  { id: 13, email: 'lequangvinh.driver@gmail.com', fullName: 'Lê Quang Vinh', kind: 'DRIVER', phone: '0962112233', address: 'Phường Hoàn Kiếm, Thành phố Hà Nội', license: { number: '010185009921', class: 'D', expiresOn: '2030-03-08' } },
  { id: 14, email: 'doanhtuan.escort@gmail.com', fullName: 'Đỗ Anh Tuấn', kind: 'ESCORT', phone: '0986223344', address: 'Phường Cầu Giấy, Thành phố Hà Nội' },
  { id: 15, email: 'ngothuhuong.escort@gmail.com', fullName: 'Ngô Thu Hương', kind: 'ESCORT', phone: '0947334455', address: 'Phường Bình Dương, TP. Hồ Chí Minh' },
];

/** Email trong bộ dữ liệu SQL cũ database/wdp_seed_v2.sql (không đăng nhập được, nhưng vẫn có thể bị bấm "Quên mật khẩu"). */
export const LEGACY_SEED_EMAILS = [
  'nguyenminhan.admin@gmail.com', 'tranhoangnam.manager@gmail.com', 'lethuha.specialist@gmail.com', 'phamgiahuy.coordinator@gmail.com',
  'vothanhdat.driver@gmail.com', 'dangngocmai.escort@gmail.com', 'nguyenbaolong.customer@gmail.com', 'tranthanhlan.customer@gmail.com',
  'leminhkhang.customer@gmail.com', 'phamngocanh.customer@gmail.com',
];

const SEED_EMAILS = new Set([...SEED_ACCOUNTS.map(account => account.email), ...LEGACY_SEED_EMAILS]);

/** Email thuộc tài khoản mẫu: không gửi thư thật. */
export function isSeedAccountEmail(email: string) {
  return SEED_EMAILS.has(email.trim().toLowerCase());
}
