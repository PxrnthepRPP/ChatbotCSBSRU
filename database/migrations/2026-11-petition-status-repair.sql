-- ==========================================================================
-- One-off migration: petition status + corrupted Thai text (2026-11)
-- ==========================================================================
-- ทำไม:
--   1. สถานะคำร้องที่ API บันทึกเป็นข้อความไทย ("อนุมัติ", "รออาจารย์ที่ปรึกษาพิจารณา" ...)
--      แต่ข้อมูล seed รุ่นแรกใช้รหัสอังกฤษ (APPROVED, PENDING, IN_REVIEW) หน้า admin จึงแสดงปนกัน
--      (DataSeeder แปลงค่าเหล่านี้ให้อัตโนมัติทุกครั้งที่ start แล้ว สคริปต์นี้แปลงซ้ำเผื่อรันกับ DB ที่ไม่ได้ start ใหม่)
--   2. บางแถวเก็บข้อความเป็น "??????" ฐานข้อมูลเป็น PostgreSQL UTF-8 จึงเก็บภาษาไทยได้ปกติ
--      แถวพวกนี้เสียตั้งแต่ฝั่ง client ที่ส่งข้อความไม่ใช่ UTF-8 (เช่น Invoke-RestMethod ของ
--      Windows PowerShell 5.1 ที่ส่ง body เป็น ISO-8859-1) ข้อความเดิมกู้คืนไม่ได้
--
-- สิ่งที่สคริปต์นี้ทำ:
--   1. แปลงรหัสสถานะอังกฤษเป็นข้อความไทย
--   2. สถานะที่เป็น "?" ล้วน: ตั้งกลับเป็นขั้นรอพิจารณาตามขั้นที่ผ่านมาแล้ว เพื่อให้คนพิจารณาใหม่
--      (ผ่านอาจารย์แล้ว -> รอผู้ดูแลระบบอนุมัติ, ยังไม่ผ่าน -> รออาจารย์ที่ปรึกษาพิจารณา)
--   3. ลบแจ้งเตือนที่หัวข้อเป็น "?" ล้วน (อ่านไม่ได้และไม่มีข้อมูลให้กู้)
--   4. แสดงคำร้องที่ชื่อเรื่อง/รายละเอียดเสีย ให้แก้ด้วยมือ (สคริปต์ไม่แก้ให้)
--
-- วิธีรัน (ยังไม่ได้รันอัตโนมัติ):
--   docker exec -i bsru_vector_db psql -U bsru_admin -d bsru_student_portal < database/migrations/2026-11-petition-status-repair.sql
-- ==========================================================================

BEGIN;

-- ตรวจดูก่อน: แถวที่จะถูกแก้
SELECT id, status, title, advisor_reviewed_at, admin_reviewed_at
FROM academic_petitions
WHERE status IN ('APPROVED', 'PENDING', 'IN_REVIEW', 'REJECTED')
   OR status ~ '^\?+$';

SELECT id, recipient_username, title FROM notifications WHERE title ~ '^[?\s]+$';

-- 1. รหัสอังกฤษ -> ข้อความไทย
UPDATE academic_petitions SET status = CASE status
        WHEN 'APPROVED'  THEN 'อนุมัติ'
        WHEN 'PENDING'   THEN 'รออาจารย์ที่ปรึกษาพิจารณา'
        WHEN 'IN_REVIEW' THEN 'รอผู้ดูแลระบบอนุมัติ'
        WHEN 'REJECTED'  THEN 'ไม่อนุมัติ'
    END
WHERE status IN ('APPROVED', 'PENDING', 'IN_REVIEW', 'REJECTED');

-- 2. สถานะเสีย -> กลับไปรอพิจารณา
UPDATE academic_petitions
SET status = CASE WHEN advisor_reviewed_at IS NOT NULL THEN 'รอผู้ดูแลระบบอนุมัติ'
                  ELSE 'รออาจารย์ที่ปรึกษาพิจารณา' END
WHERE status ~ '^\?+$';

-- 3. แจ้งเตือนที่อ่านไม่ได้
DELETE FROM notifications WHERE title ~ '^[?\s]+$';

-- 4. ให้แก้ด้วยมือ: ข้อความที่มี "???" ติดกัน
SELECT id, title, LEFT(details, 80) AS details
FROM academic_petitions
WHERE title ~ '\?{3,}' OR details ~ '\?{3,}';

COMMIT;
