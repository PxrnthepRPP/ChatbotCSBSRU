package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.LoginRequest;
import com.bsru.studentportal.dto.LoginResponse;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.model.UserAccount;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.AccountService.AccountException;
import org.springframework.security.core.Authentication;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final JwtUtil jwtUtil;
    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AccountService accountService;

    /** Show the demo-account shortcuts (and their shared password) on the login page; dev profile only */
    @Value("${app.login.show-demo-accounts:false}")
    private boolean showDemoAccounts;

    /** Public, unauthenticated: what the login page may show before anyone signs in */
    @GetMapping("/config")
    public Map<String, Object> loginConfig() {
        return Map.of("showDemoAccounts", showDemoAccounts);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }

        // Password check (BCrypt) with lockout; throws AccountException for a wrong password / locked account
        UserAccount account = accountService.authenticate(request.getUsername().trim(), request.getPassword());
        String username = account.getUsername();
        String role;
        String displayName;
        String userId = username;
        Map<String, Object> claims = new HashMap<>();

        // Role & Identity Resolution
        if ("admin".equalsIgnoreCase(username)) {
            role = "ROLE_ADMIN";
            displayName = "ผู้ดูแลระบบ (System Admin)";
        } else if ("advisor".equalsIgnoreCase(username) || username.startsWith("ADV")) {
            role = "ROLE_ADVISOR";
            // The 'advisor' demo login is advisor ADV-01 (same mapping as CurrentUser.advisorId)
            String advisorId = "advisor".equalsIgnoreCase(username) ? CurrentUser.DEMO_ADVISOR_ID : username;
            Advisor adv = advisorRepository.findById(Objects.requireNonNull(advisorId)).orElse(null);
            if (adv != null) {
                displayName = adv.getNameTh();
                userId = adv.getId();
            } else if ("advisor".equalsIgnoreCase(username)) {
                displayName = "อาจารย์ที่ปรึกษา";
            } else {
                return unknownUser(username);
            }
        } else {
            // Student: a real student id, or the 'student' demo alias
            role = "ROLE_STUDENT";
            String studentId = ("student".equalsIgnoreCase(username)) ? CurrentUser.DEMO_STUDENT_ID : username;
            Student student = studentRepository.findById(Objects.requireNonNull(studentId)).orElse(null);
            if (student == null) {
                // Unknown ids used to get a student token anyway, so the UI looked logged in
                // while the chatbot found no records (e.g. a username typed with a Thai keyboard)
                return unknownUser(username);
            }
            displayName = student.getNameTh();
            userId = student.getStudentId();
        }

        claims.put("userId", userId);
        claims.put("displayName", displayName);

        // Generate JWT Token (valid 24h)
        String token = jwtUtil.generateToken(username, role, claims);

        LoginResponse response = LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .username(username)
                .role(role)
                .displayName(displayName)
                .userId(userId)
                .expiresIn(86400000L)
                .mustChangePassword(account.isMustChangePassword())
                .build();

        log.info("User logged in successfully: username={}, role={}", username, role);
        return ResponseEntity.ok(response);
    }

    /** The logged-in user changes their own password: {"currentPassword": "...", "newPassword": "..."} */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body, Authentication authentication) {
        if (!CurrentUser.isLoggedIn(authentication)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "กรุณาเข้าสู่ระบบก่อน"));
        }
        accountService.changePassword(authentication.getName(), body.get("currentPassword"), body.get("newPassword"));
        return ResponseEntity.ok(Map.of("message", "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"));
    }

    @ExceptionHandler(AccountException.class)
    public ResponseEntity<Map<String, String>> handleAccount(AccountException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private ResponseEntity<Map<String, String>> unknownUser(String username) {
        log.warn("Login rejected, unknown username: {}", username);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "ไม่พบชื่อผู้ใช้ " + username + " ในระบบ"));
    }
}
