ALTER TABLE lessons
DROP CONSTRAINT IF EXISTS lessons_section_id_fkey;

ALTER TABLE lessons
DROP COLUMN IF EXISTS section_id;

DROP TABLE IF EXISTS tasks;

DROP TABLE IF EXISTS course_sections;
