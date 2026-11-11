package com.bsru.studentportal.service;

import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.model.UserAccount;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.repository.UserAccountRepository;
import com.bsru.studentportal.service.AccountService.AccountException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Accounts an admin creates: username = student id, first password = initials + national ID, letters in any case. */
@ExtendWith(MockitoExtension.class)
class DefaultStudentPasswordLoginTest {

    @Mock private UserAccountRepository accounts;
    @Mock private StudentRepository studentRepository;
    @Mock private AdvisorRepository advisorRepository;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private AccountService service;
    private final String id = "6621100042";
    private Student student;

    @BeforeEach
    void setUp() {
        service = new AccountService(accounts, studentRepository, advisorRepository, encoder);
        Student s = new Student();
        s.setStudentId(id);
        s.setNameTh("นายสมชาย ใจดี");
        s.setNameEn("Mr. Somchai Jaidee");
        s.setNationalId("1101700203450");
        student = s;
        lenient().when(studentRepository.findById(id)).thenReturn(Optional.of(s));
        lenient().when(studentRepository.existsById(id)).thenReturn(true);
        lenient().when(accounts.save(any(UserAccount.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private UserAccount createdAccount() {
        when(accounts.findByUsernameIgnoreCase(id)).thenReturn(Optional.empty());
        assertEquals("SJ1101700203450", service.createStudentAccount(id));
        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(accounts).save(saved.capture());
        UserAccount a = saved.getValue();
        lenient().when(accounts.findByUsernameIgnoreCase(id)).thenReturn(Optional.of(a));
        return a;
    }

    @Test
    @DisplayName("Admin creates a student: username is the student id, password SJ+national ID, must change at first login")
    void createdAccount_usesInitialsPlusId() {
        UserAccount a = createdAccount();
        assertEquals(id, a.getUsername());
        assertEquals("ROLE_STUDENT", a.getRole());
        assertTrue(a.isMustChangePassword());
        assertTrue(encoder.matches("SJ1101700203450", a.getPasswordHash()));
    }

    @Test
    @DisplayName("First login: the initials may be typed upper, lower or mixed case")
    void firstLogin_anyCase() {
        createdAccount();
        assertNotNull(service.authenticate(id, "SJ1101700203450"));
        assertNotNull(service.authenticate(id, "sj1101700203450"));
        assertNotNull(service.authenticate(id, "Sj1101700203450"));
        assertThrows(AccountException.class, () -> service.authenticate(id, "SX1101700203450"));
    }

    @Test
    @DisplayName("After the student sets their own password, case matters again")
    void ownPassword_isCaseSensitive() {
        UserAccount a = createdAccount();
        a.setPasswordHash(encoder.encode("MyPass#2026"));
        a.setMustChangePassword(false);
        assertNotNull(service.authenticate(id, "MyPass#2026"));
        assertThrows(AccountException.class, () -> service.authenticate(id, "MYPASS#2026"));
    }

    @Test
    @DisplayName("Existing account is left alone (no password returned)")
    void existingAccount_untouched() {
        when(accounts.findByUsernameIgnoreCase(id)).thenReturn(Optional.of(new UserAccount()));
        assertNull(service.createStudentAccount(id));
        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("Reset is refused for a student without a national ID (older records)")
    void reset_withoutNationalId_refused() {
        student.setNationalId(null);
        AccountException e = assertThrows(AccountException.class, () -> service.resetStudentPassword(id));
        assertTrue(e.getMessage().contains("เลขบัตรประชาชน"));
        verify(accounts, never()).save(any());
    }

    @Test
    @DisplayName("Admin reset returns the default password again")
    void reset_returnsDefault() {
        UserAccount a = createdAccount();
        a.setPasswordHash(encoder.encode("MyPass#2026"));
        a.setMustChangePassword(false);
        assertEquals("SJ1101700203450", service.resetStudentPassword(id));
        assertTrue(a.isMustChangePassword());
        assertTrue(encoder.matches("SJ1101700203450", a.getPasswordHash()));
    }
}
