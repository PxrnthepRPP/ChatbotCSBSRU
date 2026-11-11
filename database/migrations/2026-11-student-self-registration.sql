-- Migration: students register courses themselves, no admin approval
-- 1) New columns on class_sections (Hibernate ddl-auto=update also adds them; kept here for manual setups)
ALTER TABLE class_sections ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(255);
ALTER TABLE class_sections ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(50);
ALTER TABLE class_sections ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP;

-- 2) Requests still waiting under the old approval flow become confirmed / usable straight away
UPDATE section_enrollments SET status = 'CONFIRMED', review_note = NULL WHERE status = 'PENDING';
UPDATE class_sections SET approval_status = 'APPROVED', review_note = NULL WHERE approval_status = 'PENDING';

-- 3) Seats are optional now (NULL = unlimited)
ALTER TABLE class_sections ALTER COLUMN capacity DROP NOT NULL;
