// Sinh src/database/baseline-schema.ts từ bản dump test/fixtures/schema.sql (chỉ lấy CREATE TABLE).
// Chạy lại khi cần đổi lược đồ gốc: node scripts/gen-baseline-schema.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'test/fixtures/schema.sql'), 'utf8');
const statements = (source.match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g) || [])
  .filter(statement => !statement.startsWith('CREATE TABLE `migrations`'))
  .map(statement => statement.replace(/\r/g, '').replace(/ AUTO_INCREMENT=\d+/, '').replace(/;$/, ''));
if (!statements.length) throw new Error('Không đọc được CREATE TABLE trong schema.sql');

const escape = text => text.split('\\').join('\\\\').split('`').join('\\`').split('${').join('\\${');
const body = statements.map(statement => '`' + escape(statement) + '`').join(',\n');
const output = [
  '// Tệp sinh tự động bởi scripts/gen-baseline-schema.cjs, không sửa tay.',
  '// Lược đồ gốc WDP v2 trước các migration 18xxxx. Migration Init dựng các bảng này trên DB trống.',
  '// Đổi schema thì thêm migration mới, không sửa tệp này.',
  'export const baselineTables: readonly string[] = [',
  body + ',',
  '];',
  '',
].join('\n');
fs.writeFileSync(path.join(root, 'src/database/baseline-schema.ts'), output);
console.log(`Đã ghi ${statements.length} bảng vào src/database/baseline-schema.ts`);
