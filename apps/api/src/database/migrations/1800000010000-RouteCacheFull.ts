import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver map (docs/tien-do-ban-do-gps.md, Bước 4): Mapbox Directions đổi từ overview=simplified sang overview=full để
// tuyến bám từng khúc cua. location_routes là cache dùng một lần (cascade khi xóa địa điểm, hết hạn theo fetched_at),
// nên cách đơn giản nhất là xóa các tuyến ROAD đã lưu ở bản simplified: lần xem tiếp theo sẽ lấy lại bản full.
// Không thêm cột phiên bản vì schema không đổi và mọi dòng ROAD hiện có đều là bản simplified.
// STRAIGHT giữ nguyên: đó là câu trả lời "không có đường bộ" của Mapbox, không phụ thuộc kiểu overview.
export class RouteCacheFull1800000010000 implements MigrationInterface {
  name = 'RouteCacheFull1800000010000';

  async up(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM location_routes WHERE mode = 'ROAD'");
  }

  async down(): Promise<void> {
    // Dữ liệu đã xóa chỉ là cache, tự lấy lại khi xem bản đồ; không có gì để khôi phục.
  }
}
