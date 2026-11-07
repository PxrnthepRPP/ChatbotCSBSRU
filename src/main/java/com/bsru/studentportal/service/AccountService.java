package com.bsru.studentportal.service;

import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.model.UserAccount;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.repository.UserAccountRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

/** Login accounts: password check, lockout after repeated failures, change / reset password. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountService {

    /** Password of the demo accounts filled in by the role buttons on the login page */
    public static final String DEMO_PASSWORD = "password";
    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final Duration LOCK_TIME = Duration.ofMinutes(5);

    private static final String BAD_LOGIN = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";

    @Getter
    public static class AccountException extends RuntimeException {
        private final HttpStatus status;

        public AccountException(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }
    }

    private final UserAccountRepository accounts;
    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final PasswordEncoder passwordEncoder;

    /** Checks the password; returns the account or throws with a message for the login page */
    @Transactional(noRollbackFor = AccountException.class)
    public UserAccount authenticate(String username, String password) {
        UserAccount account = accounts.findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .orElseThrow(() -> new AccountException(HttpStatus.UNAUTHORIZED, BAD_LOGIN));
        LocalDateTime now = LocalDateTime.now();
        if (account.getLockedUntil() != null && account.getLockedUntil().isAfter(now)) {
            long minutes = Math.max(1, Duration.between(now, account.getLockedUntil()).toMinutes() + 1);
            throw new AccountException(HttpStatus.LOCKED,
                    "บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผ่านผิดหลายครั้ง กรุณาลองใหม่ในอีก " + minutes + " นาที");
        }
        if (password == null || !passwordEncoder.matches(password, account.getPasswordHash())) {
            account.setFailedAttempts(account.getFailedAttempts() + 1);
            String message = BAD_LOGIN;
            if (account.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                account.setLockedUntil(now.plus(LOCK_TIME));
                account.setFailedAttempts(0);
                message = "ใส่รหัสผ่านผิด " + MAX_FAILED_ATTEMPTS + " ครั้ง บัญชีถูกล็อก " + LOCK_TIME.toMinutes() + " นาที";
            } else {
                message += " (เหลืออีก " + (MAX_FAILED_ATTEMPTS - account.getFailedAttempts()) + " ครั้งก่อนบัญชีถูกล็อก)";
            }
            accounts.save(account);
            log.warn("Failed login for {}", account.getUsername());
            throw new AccountException(HttpStatus.UNAUTHORIZED, message);
        }
        account.setFailedAttempts(0);
        account.setLockedUntil(null);
        account.setLastLoginAt(now);
        return accounts.save(account);
    }

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        UserAccount account = accounts.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new AccountException(HttpStatus.NOT_FOUND, "ไม่พบบัญชีผู้ใช้"));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, account.getPasswordHash())) {
            throw new AccountException(HttpStatus.BAD_REQUEST, "รหัสผ่านปัจจุบันไม่ถูกต้อง");
        }
        String problem = passwordProblem(newPassword, account.getUsername());
        if (problem != null) throw new AccountException(HttpStatus.BAD_REQUEST, problem);
        if (passwordEncoder.matches(newPassword, account.getPasswordHash())) {
            throw new AccountException(HttpStatus.BAD_REQUEST, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
        }
        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setMustChangePassword(false);
        accounts.save(account);
    }

    /** Admin reset: the password becomes the student id and must be changed at the next login */
    @Transactional
    public void resetStudentPassword(String studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new AccountException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId);
        }
        Student s = studentRepository.findById(studentId).orElse(null);
        String initialPassword = generateDefaultStudentPassword(s, studentId);
        UserAccount account = accounts.findByUsernameIgnoreCase(studentId)
                .orElseGet(() -> newAccount(studentId, "ROLE_STUDENT", initialPassword, true));
        account.setPasswordHash(passwordEncoder.encode(initialPassword));
        account.setMustChangePassword(true);
        account.setFailedAttempts(0);
        account.setLockedUntil(null);
        accounts.save(account);
    }

    /** New student created by an admin or advisor: default password based on name/surname/birthdate, must be changed */
    @Transactional
    public void createStudentAccount(String studentId) {
        if (accounts.findByUsernameIgnoreCase(studentId).isEmpty()) {
            Student s = studentRepository.findById(studentId).orElse(null);
            String initialPassword = generateDefaultStudentPassword(s, studentId);
            accounts.save(newAccount(studentId, "ROLE_STUDENT", initialPassword, true));
        }
    }

    /**
     * Generates a default initial password using:
     * - First letter of first name (uppercase)
     * - 3 letters of last name (lowercase)
     * - Birth date in DDMMYYYY (Buddhist Era)
     * Example: Somchai Jaidee, born 15/08/2546 -> Sjai15082546
     */
    public static String generateDefaultStudentPassword(Student s, String studentId) {
        if (s == null) return studentId != null ? studentId : "DefaultPass123!";

        char firstChar = 'S';
        String name = s.getNameEn() != null && !s.getNameEn().isBlank() ? s.getNameEn().trim() : "";
        if (name.isEmpty() && s.getNameTh() != null && !s.getNameTh().isBlank()) {
            name = s.getNameTh().trim();
        }
        String[] nameParts = name.split("\\s+");
        String firstName = nameParts.length > 0 ? nameParts[0] : "";
        String lastName = nameParts.length > 1 ? nameParts[1] : "";

        for (char c : firstName.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                firstChar = Character.toUpperCase(c);
                break;
            }
        }

        StringBuilder lastPart = new StringBuilder();
        for (char c : lastName.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                lastPart.append(Character.toLowerCase(c));
                if (lastPart.length() >= 3) break;
            }
        }
        if (lastPart.length() < 3) {
            for (char c : firstName.toCharArray()) {
                if (((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) && Character.toUpperCase(c) != firstChar) {
                    lastPart.append(Character.toLowerCase(c));
                    if (lastPart.length() >= 3) break;
                }
            }
            while (lastPart.length() < 3) {
                lastPart.append("cs");
            }
            if (lastPart.length() > 3) lastPart.setLength(3);
        }

        String datePart;
        if (s.getBirthDate() != null) {
            int d = s.getBirthDate().getDayOfMonth();
            int m = s.getBirthDate().getMonthValue();
            int y = s.getBirthDate().getYear() + 543;
            datePart = String.format("%02d%02d%04d", d, m, y);
        } else {
            datePart = studentId != null && studentId.length() >= 8
                    ? studentId.substring(studentId.length() - 8)
                    : (studentId != null ? studentId : "25460101");
        }

        return firstChar + lastPart.toString() + datePart;
    }

    @Transactional
    public void deleteAccount(String username) {
        accounts.findByUsernameIgnoreCase(username).ifPresent(accounts::delete);
    }

    /**
     * Accounts for everyone who can log in but has none yet. Demo accounts (admin, advisor, student,
     * the seeded advisors and students) use the demo password so the login page buttons keep working.
     */
    @Transactional
    public void ensureAccounts() {
        ensure("admin", "ROLE_ADMIN", DEMO_PASSWORD, false);
        ensure("advisor", "ROLE_ADVISOR", DEMO_PASSWORD, false);
        ensure("student", "ROLE_STUDENT", DEMO_PASSWORD, false);
        advisorRepository.findAll().forEach(a -> ensure(a.getId(), "ROLE_ADVISOR", DEMO_PASSWORD, false));
        // Simulated (sample) students have no login
        studentRepository.findAll().stream().filter(s -> !s.isSimulated())
                .forEach(s -> ensure(s.getStudentId(), "ROLE_STUDENT", DEMO_PASSWORD, false));
    }

    /** Advanced Password Policy validation. Returns null when acceptable. */
    public static String passwordProblem(String password, String username) {
        if (password == null || password.length() < 8) return "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร";
        if (!password.matches(".*[A-Z].*")) {
            return "รหัสผ่านใหม่ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว";
        }
        if (!password.matches(".*[a-z].*")) {
            return "รหัสผ่านใหม่ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว";
        }
        if (!password.matches(".*\\d.*")) {
            return "รหัสผ่านใหม่ต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว";
        }
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*")) {
            return "รหัสผ่านใหม่ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (เช่น !@#$%^&*)";
        }
        if (username != null && !username.isBlank() && password.toLowerCase().contains(username.toLowerCase())) {
            return "รหัสผ่านต้องไม่มีชื่อผู้ใช้หรือรหัสนักศึกษา";
        }
        return null;
    }

    private void ensure(String username, String role, String password, boolean mustChange) {
        if (accounts.findByUsernameIgnoreCase(username).isEmpty()) {
            accounts.save(newAccount(username, role, password, mustChange));
        }
    }

    private UserAccount newAccount(String username, String role, String password, boolean mustChange) {
        UserAccount a = new UserAccount();
        a.setUsername(username);
        a.setRole(role);
        a.setPasswordHash(passwordEncoder.encode(password));
        a.setMustChangePassword(mustChange);
        return a;
    }
}
