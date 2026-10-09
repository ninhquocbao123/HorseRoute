"""Build replacement SQL and verify its delete order and rollback in memory."""
import re
import convert_excel as source

sql = (source.out / 'wdp_du_lieu_import.sql').read_text(encoding='utf-8')
deletes = ['UPDATE `horse_logs` SET `corrects_log_id` = NULL;']
deletes += [f'DELETE FROM `{name}`;' for name in reversed(source.order)]
# Validate all FK dependencies with foreign_keys enabled, and rollback recovery.
db = source.db
db.commit()
before = {name: db.execute(f'SELECT * FROM `{name}`').fetchall() for name in source.order}
db.execute('BEGIN')
for statement in deletes:
    db.execute(statement)
assert all(db.execute(f'SELECT COUNT(*) FROM `{name}`').fetchone()[0] == 0 for name in source.order)
db.rollback()
assert all(db.execute(f'SELECT * FROM `{name}`').fetchall() == before[name] for name in source.order)
db.execute('BEGIN')
for statement in deletes + source.statements:
    db.execute(statement)
assert not db.execute('PRAGMA foreign_key_check').fetchall()
assert all(db.execute(f'SELECT * FROM `{name}`').fetchall() == before[name] for name in source.order)
db.rollback()

sql = sql.replace('-- Chỉ chạy khi 24 bảng rỗng, không có tiến trình khác ghi đồng thời.',
    '-- THAY TOÀN BỘ dữ liệu 24 bảng wdp bằng Excel. Dừng ứng dụng ghi dữ liệu khi chạy.')
sql = sql.replace('-- Không xóa dữ liệu và không tắt khóa ngoại. MySQL >= 8.0.16.',
    '-- DELETE + INSERT trong một transaction; lỗi sẽ ROLLBACK. Giữ kiểm tra FK. MySQL >= 8.0.16.')
sql = sql.replace('import_wdp_excel_20261008', 'replace_wdp_excel_20261008')
sql = sql.replace('SET @wdp_previous_sql_mode = @@SESSION.sql_mode;',
    'SET @wdp_previous_sql_mode = @@SESSION.sql_mode;\nSET @wdp_previous_safe_updates = @@SESSION.sql_safe_updates;')
sql = sql.replace('    ROLLBACK;',
    '    ROLLBACK;\n    SET SESSION sql_safe_updates = @wdp_previous_safe_updates;')
sql = sql.replace('  START TRANSACTION;', '  SET SESSION sql_safe_updates = 0;\n  START TRANSACTION;')
sql = re.sub(r'  IF EXISTS[\s\S]*?  END IF;', '\n'.join(deletes), sql, count=1)
sql = sql.replace('  COMMIT;', '  COMMIT;\n  SET SESSION sql_safe_updates = @wdp_previous_safe_updates;')
sql = sql.replace('CREATE PROCEDURE replace_wdp_excel_20261008()',
    'CREATE PROCEDURE replace_wdp_excel_20261008()')
(source.out / 'wdp_thay_bang_excel.sql').write_text(sql, encoding='utf-8')
print('PASS: delete order with FK enabled, rollback preserves prior rows, replacement matches all 486 source rows. MySQL runtime not tested.')
