package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.service.AccountService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

public class StudentCsvPasswordAndRoleTest {

    @Test
    @DisplayName("Password Formula: First letter of name + 3 letters of last name + birth date in B.E.")
    void testDefaultPasswordGeneration_withEnglishNameAndBirthDate() {
        Student s = new Student();
        s.setStudentId("6621207044");
        s.setNameTh("ปิติพัฒน์ นิ่มจินดา");
        s.setNameEn("Pitiphat Nimjinda");
        s.setBirthDate(LocalDate.of(2003, 8, 15)); // 15/08/2546

        String password = AccountService.generateDefaultStudentPassword(s, s.getStudentId());
        // P (first of Pitiphat) + nim (3 chars of Nimjinda) + 15082546 (DDMMYYYY B.E.)
        assertEquals("Pnim15082546", password);
    }

    @Test
    @DisplayName("Password Formula: Fallback to student ID if student is null")
    void testDefaultPasswordGeneration_nullStudent_returnsStudentId() {
        String password = AccountService.generateDefaultStudentPassword(null, "6621207034");
        assertEquals("6621207034", password);
    }

    @Test
    @DisplayName("Password Formula: Fallback when birthDate is missing uses student ID digits")
    void testDefaultPasswordGeneration_noBirthDate_usesStudentIdDigits() {
        Student s = new Student();
        s.setStudentId("6621207055");
        s.setNameTh("สุกี้ แจ้งสมบุญ");
        s.setNameEn("Suki Jaengsombun");
        s.setBirthDate(null);

        String password = AccountService.generateDefaultStudentPassword(s, s.getStudentId());
        assertEquals("Sjae21207055", password);
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

        // No special character
        assertNotNull(AccountService.passwordProblem("Password123", "6621207044"));

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

