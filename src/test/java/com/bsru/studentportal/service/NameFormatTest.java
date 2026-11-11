package com.bsru.studentportal.service;

import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** English names are stored and shown as "Somchai Jaidee" whatever case the admin typed */
class NameFormatTest {

    @Test
    @DisplayName("Each word starts with a capital, the rest is lower case; Thai is untouched")
    void titleCase() {
        assertEquals("Somchai Jaidee", NameFormat.titleCaseEn("somchai jaidee"));
        assertEquals("Somchai Jaidee", NameFormat.titleCaseEn("SOMCHAI JAIDEE"));
        assertEquals("Mr. Sirilak Mobileapp", NameFormat.titleCaseEn("mr. sirilak MobileApp"));
        assertEquals("Miss Kulanan Ios", NameFormat.titleCaseEn("miss kulanan iOS"));
        assertEquals("O'Neil-Smith", NameFormat.titleCaseEn("o'neil-smith"));
        assertEquals("สมชาย ใจดี", NameFormat.titleCaseEn("สมชาย ใจดี"));
        assertNull(NameFormat.titleCaseEn(null));
    }

    @Test
    @DisplayName("Student and advisor entities apply it whenever they are saved")
    void entitiesNormaliseOnSave() {
        Student s = new Student();
        s.setStudentId("6921100001");
        s.setNameEn("mr. SOMCHAI jaidee");
        s.prePersist();
        assertEquals("Mr. Somchai Jaidee", s.getNameEn());
        s.setNameEn("pitipat NIMJINDA");
        s.preUpdate();
        assertEquals("Pitipat Nimjinda", s.getNameEn());

        Advisor a = new Advisor("ADV-99", "อ.ทดสอบ", "dr. test TEACHER", "t@bsru.ac.th", null, null);
        a.normalizeNames();
        assertEquals("Dr. Test Teacher", a.getNameEn());
    }
}
