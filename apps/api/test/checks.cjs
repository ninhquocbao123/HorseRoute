// Ca kiểm tra cho test tích hợp MySQL: ca lỗi được ghi FAIL rồi chạy tiếp ca sau, done() ném lỗi liệt kê mọi ca lỗi.
// Ca sau có thể lỗi theo ca trước khi dùng chung dữ liệu; sửa ca lỗi đầu tiên trước.
module.exports = function createChecks() {
  const failed = [];
  const checks = {
    passed: 0,
    failed,
    async check(label, fn) {
      try {
        await fn();
        checks.passed++;
        console.log('PASS ' + label);
      } catch (error) {
        failed.push(label);
        console.error('FAIL ' + label);
        console.error(error);
      }
    },
    done() {
      if (failed.length) throw new Error(`${failed.length} ca lỗi:\n- ${failed.join('\n- ')}`);
    },
  };
  return checks;
};
