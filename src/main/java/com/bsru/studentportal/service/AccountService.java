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
        if (password == null || !passwordMatches(account, password)) {
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
        if (currentPassword == null || !passwordMatches(account, currentPassword)) {
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

    /**
     * Exact match, or — for a student still on the default password (upper-case initials + student id) —
     * the same password with the letters typed in lower or mixed case (sj6621100042, Sj6621100042).
     */
    private boolean passwordMatches(UserAccount account, String password) {
        if (passwordEncoder.matches(password, account.getPasswordHash())) return true;
        boolean onDefaultPassword = account.isMustChangePassword() && "ROLE_STUDENT".equals(account.getRole());
        String upper = password.toUpperCase();
        return onDefaultPassword && !upper.equals(password) && passwordEncoder.matches(upper, account.getPasswordHash());
    }

    /** Admin reset: the password goes back to the default (see generateDefaultStudentPassword) and must be changed */
    @Transactional
    public String resetStudentPassword(String studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new AccountException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId);
        }
        Student s = studentRepository.findById(studentId).orElse(null);
        if (s == null || s.getNationalId() == null || s.getNationalId().isBlank()) {
            throw new AccountException(HttpStatus.BAD_REQUEST,
                    "นักศึกษารหัส " + studentId + " ยังไม่มีเลขบัตรประชาชน กรุณาแก้ไขข้อมูลนักศึกษาเพิ่มเลขบัตรประชาชนก่อนรีเซ็ตรหัสผ่าน");
        }
        String initialPassword = generateDefaultStudentPassword(s, studentId);
        UserAccount account = accounts.findByUsernameIgnoreCase(studentId)
                .orElseGet(() -> newAccount(studentId, "ROLE_STUDENT", initialPassword, true));
        account.setPasswordHash(passwordEncoder.encode(initialPassword));
        account.setMustChangePassword(true);
        account.setFailedAttempts(0);
        account.setLockedUntil(null);
        accounts.save(account);
        return initialPassword;
    }

    /**
     * New student created by an admin (form or CSV): username = student id, default password from
     * generateDefaultStudentPassword, must be changed at the first login.
     * Returns the password, or null when the student already had an account (left untouched).
     */
    @Transactional
    public String createStudentAccount(String studentId) {
        if (accounts.findByUsernameIgnoreCase(studentId).isPresent()) return null;
        Student s = studentRepository.findById(studentId).orElse(null);
        String initialPassword = generateDefaultStudentPassword(s, studentId);
        accounts.save(newAccount(studentId, "ROLE_STUDENT", initialPassword, true));
        return initialPassword;
    }

    /** Titles written before a name, skipped when taking the initials */
    private static final java.util.Set<String> NAME_TITLES = java.util.Set.of(
            "MR", "MRS", "MS", "MISS", "DR", "นาย", "นาง", "นางสาว", "น.ส.", "ด.ช.", "ด.ญ.", "เด็กชาย", "เด็กหญิง");
    private static final java.util.List<String> THAI_TITLE_PREFIXES = java.util.List.of(
            "นางสาว", "เด็กชาย", "เด็กหญิง", "นาย", "นาง", "น.ส.", "ด.ช.", "ด.ญ.");

    /**
     * Default first password of a student: first letter of the first name + first letter of the last
     * name (upper case) followed by the 13-digit national ID, e.g. Somchai Jaidee 1101700203450 -> SJ1101700203450.
     * Uses the English name; titles (Mr., นาย, ...) are skipped. Without an English first and last name
     * it uses the Thai name (สจ1101700203450). The national ID keeps the password private (the student id
     * is public); a student recorded without one (older data) falls back to the student id.
     * At the first login the letters may be typed in either case (see authenticate).
     */
    public static String generateDefaultStudentPassword(Student s, String studentId) {
        String id = studentId != null ? studentId : (s != null ? s.getStudentId() : "");
        if (s == null) return id;
        if (s.getNationalId() != null && !s.getNationalId().isBlank()) id = s.getNationalId();
        String initials = initials(s.getNameEn(), true);
        if (initials == null) initials = initials(s.getNameTh(), false);
        return (initials == null ? "" : initials) + id;
    }

    /** Upper-case first letters of the first two name words, or null when there are not two */
    private static String initials(String fullName, boolean english) {
        if (fullName == null || fullName.isBlank()) return null;
        java.util.List<Character> letters = new java.util.ArrayList<>();
        for (String word : fullName.trim().split("\\s+")) {
            String w = word.trim();
            if (NAME_TITLES.contains(w.replace(".", "").toUpperCase()) || NAME_TITLES.contains(w)) continue;
            if (!english) {
                // Thai titles are often written stuck to the name: นายสมชาย
                for (String t : THAI_TITLE_PREFIXES) {
                    if (w.startsWith(t) && w.length() > t.length()) { w = w.substring(t.length()); break; }
                }
            }
            for (char c : w.toCharArray()) {
                boolean ok = english ? ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) : (c >= 'ก' && c <= 'ฮ');
                if (ok) { letters.add(Character.toUpperCase(c)); break; }
            }
            if (letters.size() == 2) break;
        }
        return letters.size() == 2 ? "" + letters.get(0) + letters.get(1) : null;
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

    /**
     * Password policy for every role: at least 8 characters with an upper-case letter, a lower-case
     * letter and a digit, and not containing the username. Returns null when acceptable.
     */
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
        // Special characters (!@#...) are allowed but not required
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
