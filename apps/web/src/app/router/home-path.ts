/** Trang làm việc chính của vai trò (nút "Về trang làm việc" ở trang lỗi). Điều phối: trang Tổng quan đã bỏ, mở danh sách chuyến. */
export function homePathFor(role?: string | null) {
  return role === 'COORDINATOR' ? '/coordinator/trips' : '/dashboard';
}
