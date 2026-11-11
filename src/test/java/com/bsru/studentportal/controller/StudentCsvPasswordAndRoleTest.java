package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.service.AccountService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

public class StudentCsvPasswordAndRoleTest {

    private static Student student(String id, String nameTh, String nameEn) {
        Student s = new Student();
        s.setStudentId(id);
        s.setNameTh(nameTh);
        s.setNameEn(nameEn);
        s.setBirthDate(LocalDate.of(2003, 8, 15));   // no longer part of the password
        return s;
    }

    @Test
    @DisplayName("Password Formula: first letter of first name + first letter of last name (upper case) + student id")
    void testDefaultPassword_englishInitialsPlusStudentId() {
        assertEquals("SJ6621100042", AccountService.generateDefaultStudentPassword(
                student("6621100042", "สมชาย ใจดี", "Somchai Jaidee"), "6621100042"));
        assertEquals("PN6621207044", AccountService.generateDefaultStudentPassword(
                student("6621207044", "ปิติพัฒน์ นิ่มจินดา", "pitipat nimjinda"), "6621207044"));
    }

    @Test
    @DisplayName("Password Formula: with a national ID the password is initials + the 13-digit national ID")
    void testDefaultPassword_initialsPlusNationalId() {
        Student s = student("6621100042", "สมชาย ใจดี", "Somchai Jaidee");
        s.setNationalId("1101700203450");
        assertEquals("SJ1101700203450", AccountService.generateDefaultStudentPassword(s, "6621100042"));
    }

    @Test
    @DisplayName("National ID: check digit, normalising dashes, masking")
    void testNationalIdRules() {
        assertTrue(com.bsru.studentportal.service.NationalId.isValid("1101700203450"));
        assertFalse(com.bsru.studentportal.service.NationalId.isValid("1101700203451"));
        assertFalse(com.bsru.studentportal.service.NationalId.isValid("110170020345"));
        assertEquals("1101700203450", com.bsru.studentportal.service.NationalId.normalize("1-1017-00203-45-0"));
        assertEquals("x-xxxx-xxxxx-45-0", com.bsru.studentportal.service.NationalId.mask("1101700203450"));
        assertNotNull(com.bsru.studentportal.service.NationalId.problem(""));
        assertNull(com.bsru.studentportal.service.NationalId.problem("1101700203450"));
    }

    @Test
    @DisplayName("Password Formula: titles such as Mr. / Miss / นาย are skipped")
    void testDefaultPassword_skipsTitles() {
        assertEquals("CC6421100074", AccountService.generateDefaultStudentPassword(
                student("6421100074", "นายชัยวัฒน์ โค้ดดิ้ง", "Mr. Chaiwat Coding"), "6421100074"));
        assertEquals("KP6521100088", AccountService.generateDefaultStudentPassword(
                student("6521100088", "นางสาวกมล พรหมดี", "Miss Kamon Promdee"), "6521100088"));
    }

    @Test
    @DisplayName("Password Formula: no English name -> Thai initials (title stuck to the name removed)")
    void testDefaultPassword_thaiFallback() {
        assertEquals("สจ6621100042", AccountService.generateDefaultStudentPassword(
                student("6621100042", "นายสมชาย ใจดี", "นายสมชาย ใจดี"), "6621100042"));
        assertEquals("สจ6621100042", AccountService.generateDefaultStudentPassword(
                student("6621100042", "สมชาย ใจดี", null), "6621100042"));
    }

    @Test
    @DisplayName("Password Formula: no usable name or no student -> just the student id")
    void testDefaultPassword_fallbackToStudentId() {
        assertEquals("6621207034", AccountService.generateDefaultStudentPassword(null, "6621207034"));
        assertEquals("6621207034", AccountService.generateDefaultStudentPassword(
                student("6621207034", "สมชาย", "Somchai"), "6621207034"));
    }

    @Test
    @DisplayName("Advanced Password Policy: rejects weak passwords and accepts strong")
    void testAdvancedPasswordPolicy() {
        // Less than 8 chars
        assertNotNull(AccountService.passwordProblem("Ab1!", "6621207044"));

        // No uppercase
        assertNotNull(AccountService.passwordProblem("password123!", "6621207044"));

        // No lowercase
        assertNotNull(AccountService.passwordProblem("PASSWORD123!", "6621207044"));

        // No number
        assertNotNull(AccountService.passwordProblem("Password!@#", "6621207044"));

        // Special characters are optional now (every role)
        assertNull(AccountService.passwordProblem("Password123", "6621207044"));
        assertNull(AccountService.passwordProblem("Password123!", "6621207044"));

        // Contains username
        assertNotNull(AccountService.passwordProblem("6621207044Pass!", "6621207044"));

        // Valid strong password
        assertNull(AccountService.passwordProblem("BsruPortal2026!", "6621207044"));
        assertNull(AccountService.passwordProblem("StrongPass#89", "user123"));
    }

    @Test
    @DisplayName("Flexible Date Parser: parses ISO, DD/MM/YYYY and converts B.E. to A.D.")
    void testParseFlexibleDate() {
        // ISO yyyy-MM-dd
        LocalDate d1 = StudentAdminController.parseFlexibleDate("2003-08-15");
        assertNotNull(d1);
        assertEquals(LocalDate.of(2003, 8, 15), d1);

        // dd/MM/yyyy A.D.
        LocalDate d2 = StudentAdminController.parseFlexibleDate("15/08/2003");
        assertNotNull(d2);
        assertEquals(LocalDate.of(2003, 8, 15), d2);

        // dd/MM/yyyy B.E. (2546 - 543 = 2003)
        LocalDate d3 = StudentAdminController.parseFlexibleDate("15/08/2546");
        assertNotNull(d3);
        assertEquals(LocalDate.of(2003, 8, 15), d3);

        // dd-MM-yyyy B.E.
        LocalDate d4 = StudentAdminController.parseFlexibleDate("15-08-2546");
        assertNotNull(d4);
        assertEquals(LocalDate.of(2003, 8, 15), d4);

        // null or blank returns null
        assertNull(StudentAdminController.parseFlexibleDate(""));
        assertNull(StudentAdminController.parseFlexibleDate(null));
        assertNull(StudentAdminController.parseFlexibleDate("not-a-date"));
    }

    @Test
    @DisplayName("Advisor Model: canAdmin field and 6-parameter constructor")
    void testAdvisorCanAdmin() {
        Advisor adv = new Advisor("ADV-01", "ผศ.ดร.วิชัย", "Dr. Wichai", "wichai@bsru.ac.th", "0812345678", "CS");
        assertFalse(adv.isCanAdmin());

        adv.setCanAdmin(true);
        assertTrue(adv.isCanAdmin());
    }
}

