-- Migration: English names of students and advisors in one style
-- Every word starts with a capital, the rest lower case ("pitipat nimjinda" -> "Pitipat Nimjinda").
-- New and edited rows get this from the entities (NameFormat.titleCaseEn, same rule as initcap).
UPDATE students SET name_en = initcap(name_en) WHERE name_en IS NOT NULL AND name_en <> initcap(name_en);
UPDATE advisors SET name_en = initcap(name_en) WHERE name_en IS NOT NULL AND name_en <> initcap(name_en);
