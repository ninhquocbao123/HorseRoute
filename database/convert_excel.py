import datetime as dt
import json
import re
import sqlite3
from pathlib import Path
import openpyxl

source = Path(r'C:\Users\Ninh Quoc Bao\Downloads\wdp_du_lieu.xlsx')
schema = Path(r'D:\FPTU\Ky 8\WDP301\db\wdp_schema_v2.sql').read_text(encoding='utf-8-sig')
out = Path(__file__).parent
wb = openpyxl.load_workbook(source, data_only=False)
tables = dict(re.findall(r'CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE=', schema))
data = {}
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
for name, body in tables.items():
    defs = []
    for line in body.splitlines():
        line = line.strip().rstrip(',')
        if not line or line.startswith('KEY '): continue
        line = re.sub(r" COMMENT '[^']*'", '', line)
        line = re.sub(r'^UNIQUE KEY \w+', 'UNIQUE', line)
        line = line.replace('BIGINT UNSIGNED', 'INTEGER').replace('AUTO_INCREMENT', '')
        line = line.replace('DEFAULT (UTC_TIMESTAMP())', "DEFAULT '2026-10-08 00:00:00'")
        enum = re.match(r'(\w+)\s+ENUM\(([^)]+)\)', line)
        if enum:
            line = re.sub(r'ENUM\([^)]+\)', 'TEXT', line) + f' CHECK ({enum[1]} IN ({enum[2]}))'
        defs.append(line)
    alter = re.search(r'ALTER TABLE '+name+r'\s+([\s\S]*?);', schema)
    if alter:
        defs += re.findall(r'FOREIGN KEY \(\w+\) REFERENCES \w+ \(\w+\)', alter[1])
    db.execute(f'CREATE TABLE {name} ({",".join(defs)})')
    sheet = wb[name]
    cols = [c.value for c in sheet[4]]
    schema_cols = dict(re.findall(r'^  (\w+)\s+((?:BIGINT|VARCHAR|CHAR|ENUM|TEXT|DATE|DATETIME|BOOLEAN|INT)\b[^\n]*)', body, re.M))
    assert set(cols) == set(schema_cols), (name, 'columns differ')
    rows = []
    for row in sheet.iter_rows(min_row=5):
        if all(c.value is None for c in row): continue
        values = []
        for col, cell in zip(cols, row):
            v = cell.value
            assert cell.data_type != 'f', f'Formula requires evaluation: {name}!{cell.coordinate}'
            typ = schema_cols[col]
            if v is None:
                assert 'NOT NULL' not in typ, f'Missing value: {name}!{cell.coordinate}'
            elif isinstance(v, dt.datetime):
                v = v.strftime('%Y-%m-%d %H:%M:%S' if typ.startswith('DATETIME') else '%Y-%m-%d')
            elif typ.startswith(('VARCHAR','CHAR','TEXT','ENUM')):
                v = str(v)
                limit = re.match(r'(?:VAR)?CHAR\((\d+)\)',typ)
                assert not limit or len(v)<=int(limit[1]), f'Text too long: {name}!{cell.coordinate}'
            elif isinstance(v, (int,float)):
                assert int(v)==v, f'Noninteger: {name}!{cell.coordinate}'
                v = int(v)
                assert 'UNSIGNED' not in typ or v>=0
            values.append(v)
        rows.append(values)
    data[name]=(cols,rows)

order=['users','system_parameters','document_types','authorities','locations','vehicles','carriers','orders','horses','quarantine_rules','quarantine_rule_doctypes','documents','trips','trip_assignments','legs','leg_milestones','horse_logs','incidents','alerts','attachments','document_versions','dossiers','notifications','audit_logs']
def literal(v):
    if v is None: return 'NULL'
    if isinstance(v,int): return str(v)
    return "'"+v.replace("'","''")+"'"

statements=[]
for name in order:
    cols,rows=data[name]
    for idx,row in enumerate(rows,5):
        try: db.execute(f'INSERT INTO {name} ({",".join(cols)}) VALUES ({",".join("?" for _ in cols)})',row)
        except Exception as e: raise ValueError(f'{name}, Excel row {idx}: {e}') from e
    if rows:
        statements.append(f'-- Sheet {name}: {len(rows)} rows, Excel rows 5 onward.\nINSERT INTO `{name}` ({", ".join("`"+c+"`" for c in cols)}) VALUES\n'+',\n'.join('('+', '.join(map(literal,r))+')' for r in rows)+';')
assert not db.execute('PRAGMA foreign_key_check').fetchall()
# Verify serialized SQL as well as parameterized source values.
db.rollback()
db.executescript('\n'.join(statements))
for name,(cols,rows) in data.items():
    actual=db.execute(f'SELECT {",".join(cols)} FROM {name}').fetchall()
    assert sorted(map(repr,actual)) == sorted(repr(tuple(r)) for r in rows), name
checks={
 'Ngựa có chủ khác khách hàng của đơn': 'SELECT h.id FROM horses h JOIN orders o ON o.id=h.order_id WHERE h.owner_id<>o.customer_id',
 'Nhật ký gắn ngựa và chuyến khác đơn': 'SELECT h.id FROM horse_logs h JOIN horses x ON x.id=h.horse_id JOIN legs l ON l.id=h.leg_id JOIN trips t ON t.id=l.trip_id WHERE x.order_id<>t.order_id',
 'Sự cố gắn chặng khác chuyến': 'SELECT i.id FROM incidents i JOIN legs l ON l.id=i.leg_id WHERE i.trip_id<>l.trip_id',
 'Sự cố gắn ngựa khác đơn của chuyến': 'SELECT i.id FROM incidents i JOIN horses h ON h.id=i.horse_id JOIN trips t ON t.id=i.trip_id WHERE h.order_id<>t.order_id',
 'Phiên bản upload sau thời điểm duyệt giấy tờ': 'SELECT v.id FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.uploaded_at>d.reviewed_at',
 'Chặng đến trước lúc xuất phát thực tế': 'SELECT id FROM legs WHERE actual_arrival_at<actual_departure_at',
}
issues={label:[r[0] for r in db.execute(q)] for label,q in checks.items()}
guard=' OR\n     '.join(f'EXISTS (SELECT 1 FROM `{t}`)' for t in tables)
sql='''-- Chuyển nguyên dữ liệu từ wdp_du_lieu.xlsx. Không xác thực tính có thật.
-- Workbook tự mô tả là dữ liệu mẫu; password_hash còn là <bcrypt-hash>.
-- Giữ nguyên ID, nội dung, thời gian trong Excel; không tự đổi múi giờ.
-- Chỉ chạy khi 24 bảng rỗng, không có tiến trình khác ghi đồng thời.
-- Không xóa dữ liệu và không tắt khóa ngoại. MySQL >= 8.0.16.
USE wdp;
SET NAMES utf8mb4;
SET @wdp_previous_sql_mode = @@SESSION.sql_mode;
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@wdp_previous_sql_mode,''), 'NO_BACKSLASH_ESCAPES', 'STRICT_ALL_TABLES');
DELIMITER //
CREATE PROCEDURE import_wdp_excel_20261008()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET SESSION sql_mode = @wdp_previous_sql_mode;
    RESIGNAL;
  END;
  START TRANSACTION;
  IF '''+guard+''' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Import requires all 24 tables to be empty. No data changed.';
  END IF;

'''+ '\n\n'.join(statements)+'''
  COMMIT;
END;
//
DELIMITER ;
CALL import_wdp_excel_20261008();
DROP PROCEDURE import_wdp_excel_20261008;
SET SESSION sql_mode = @wdp_previous_sql_mode;

'''+ '\nUNION ALL '.join(f"SELECT '{t}' AS table_name, COUNT(*) AS row_count FROM `{t}`" for t in order)+';\n'
(out/'wdp_du_lieu_import.sql').write_text(sql,encoding='utf-8')
report=['# Kết quả chuyển Excel sang SQL','',f'Nguồn: `{source}`','',f'Tổng: {sum(len(r) for c,r in data.values())} bản ghi, 24 bảng.',
 '', 'Giữ nguyên dữ liệu nguồn; không tự thêm, sửa hoặc xác nhận đây là dữ liệu thực tế. Workbook ghi rõ dữ liệu mẫu tại Muc_luc!A6 và phần mô tả từng sheet. password_hash đang là <bcrypt-hash>, không dùng được để đăng nhập. Đường dẫn attachment không chứng minh tệp đã tồn tại.',
 '', 'Giữ nguyên thời gian Excel. Schema quy ước UTC; nếu Excel nhập giờ Việt Nam thì cần xác nhận trước khi đổi giờ.',
 '', 'Đã kiểm tra cột, trường bắt buộc, độ dài CHAR/VARCHAR, kiểu số nguyên, PK/UNIQUE/FK/CHECK/ENUM bằng SQLite trong bộ nhớ sau khi chuyển đổi schema. Chưa thực thi trên MySQL; kiểm tra collation utf8mb4_unicode_ci và stored procedure cần MySQL.', '', '| Bảng | Số dòng |', '|---|---:|']
report += [f'| {t} | {len(data[t][1])} |' for t in order]
report += ['', '## Kiểm tra nghiệp vụ (không tự sửa nguồn)']
report += [f'- {label}: '+(', '.join(map(str,ids))+' (ID)' if ids else 'Không phát hiện.') for label,ids in issues.items()]
report += ['', '## Cách nhập', '1. Mở wdp_du_lieu_import.sql bằng File → Open SQL Script trong MySQL Workbench.', '2. Kết nối database wdp đúng schema v2, 24 bảng rỗng. Không chạy lại schema gốc vì có DROP DATABASE.', '3. Chạy toàn bộ file bằng Ctrl+Shift+Enter. Không chỉ chạy các INSERT hoặc CREATE PROCEDURE riêng lẻ.', '4. Đối chiếu bảng đếm kết quả cuối file với bảng trên.', '5. Nếu báo bảng đã có dữ liệu, dừng và kiểm tra; không xóa dữ liệu để ép nhập. Nếu Workbench dừng lỗi khiến procedure còn tồn tại, sau khi xử lý nguyên nhân chạy DROP PROCEDURE IF EXISTS wdp.import_wdp_excel_20261008; trước khi thử lại. Nếu dừng lỗi trước bước khôi phục sql_mode, ngắt và kết nối lại phiên.', '', 'File này cần quyền CREATE ROUTINE, EXECUTE, ALTER ROUTINE, SELECT và INSERT. Không sửa file Excel nguồn.']
(out/'wdp_du_lieu_kiem_tra.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
print(json.dumps({'rows':sum(len(r) for c,r in data.values()),'tables':len(data),'issues':issues},ensure_ascii=False))
