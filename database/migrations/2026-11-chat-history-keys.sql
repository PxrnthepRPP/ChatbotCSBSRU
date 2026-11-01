-- ==========================================================================
-- One-off migration: chat history keys (2026-11)
-- ==========================================================================
-- ทำไม:
--   เดิม frontend ส่ง sessionId = username (เช่น "6421100042") หรือ 'student_guest' และ backend
--   บันทึก session_id ตามค่าที่ client ส่งมา ส่วน user_key มาจาก JWT (student:<id>, advisor:<id>,
--   staff:<name>) หรือ guest:<ค่าที่ client ส่ง>
--   ตอนนี้ backend ใช้ key ที่ได้จาก JWT เท่านั้น และบันทึก session_id = user_key = key เดียวกัน
--   อ่าน/ลบประวัติด้วย user_key เท่านั้น
--
-- สิ่งที่สคริปต์นี้ทำ:
--   1. แถวของผู้ใช้ที่ login (user_key มาจาก JWT จึงเชื่อถือได้) -> session_id = user_key
--      ผู้ใช้จึงยังเห็นประวัติเดิมของตัวเอง (เช่น session_id '6421100042' -> 'student:6421100042')
--   2. (ไม่บังคับ) ลบประวัติ guest แบบเก่า ซึ่งเคยใช้ key ร่วมกันทุกคน ('guest:student_guest',
--      'guest:guest-session') หรือ key ที่ client ตั้งเองได้ — key ใหม่ของ guest เป็น UUID ต่อแท็บ
--      แถวเหล่านี้จึงไม่มีใครเปิดดูได้อีกแล้ว
--
-- ห้ามใช้ session_id เดิมเพื่อเดาเจ้าของ: ผู้ไม่ได้ login เคยส่ง sessionId เป็นอะไรก็ได้
-- (เช่น '6421100042' หรือ 'student:6421100042') แถวพวกนั้นมี user_key = 'guest:...' จึงไม่ถูกย้าย
--
-- วิธีรัน (ยังไม่ได้รันอัตโนมัติ):
--   docker exec -i bsru_vector_db psql -U bsru_admin -d bsru_student_portal < database/migrations/2026-11-chat-history-keys.sql
-- ==========================================================================

BEGIN;

-- ตรวจดูก่อน: จำนวนแถวที่จะถูกแก้
SELECT
    COUNT(*) FILTER (WHERE (user_key LIKE 'student:%' OR user_key LIKE 'advisor:%' OR user_key LIKE 'staff:%')
                       AND session_id IS DISTINCT FROM user_key)  AS logged_in_rows_to_rekey,
    COUNT(*) FILTER (WHERE user_key LIKE 'guest:%')               AS legacy_guest_rows,
    COUNT(*) FILTER (WHERE user_key IS NULL)                      AS rows_without_user_key
FROM chat_history_entries;

-- 1. ผู้ใช้ที่ login: session_id = user_key (เช่น '6421100042' -> 'student:6421100042')
UPDATE chat_history_entries
SET session_id = user_key
WHERE (user_key LIKE 'student:%' OR user_key LIKE 'advisor:%' OR user_key LIKE 'staff:%')
  AND session_id IS DISTINCT FROM user_key;

-- 2. (ไม่บังคับ) ลบประวัติ guest แบบเก่าที่ไม่มีใครเข้าถึงได้อีก — เอา comment ออกถ้าต้องการ
-- DELETE FROM chat_history_entries WHERE user_key LIKE 'guest:%';

COMMIT;
