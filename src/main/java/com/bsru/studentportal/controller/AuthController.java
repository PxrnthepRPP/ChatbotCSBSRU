package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.LoginRequest;
import com.bsru.studentportal.dto.LoginResponse;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }

        String username = request.getUsername().trim();
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
            Advisor adv = advisorRepository.findById(Objects.requireNonNull(username)).orElse(null);
            if (adv != null) {
                displayName = adv.getNameTh();
                userId = adv.getId();
            } else {
                displayName = "อาจารย์ที่ปรึกษา";
            }
        } else {
            // Default to student (matching 10-digit ID or 'student')
            role = "ROLE_STUDENT";
            String studentId = ("student".equalsIgnoreCase(username)) ? "6421100042" : username;
            Student student = studentRepository.findById(Objects.requireNonNull(studentId)).orElse(null);
            if (student != null) {
                displayName = student.getNameTh();
                userId = student.getStudentId();
            } else {
                displayName = "นักศึกษา (" + studentId + ")";
                userId = studentId;
            }
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
                .build();

        log.info("User logged in successfully: username={}, role={}", username, role);
        return ResponseEntity.ok(response);
    }
}
