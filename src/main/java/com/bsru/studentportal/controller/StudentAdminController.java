package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.StudentProfileRequest;
import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.AccountService.AccountException;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Admin-only create / update / delete of students, saved to the database. */
@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class StudentAdminController {

    private final StudentAdminService studentAdminService;
    private final AccountService accountService;

    @PostMapping
    public ResponseEntity<?> create(@RequestBody StudentRequest request, Authentication auth) {
        requireAdmin(auth);
        return ResponseEntity.status(HttpStatus.CREATED).body(studentAdminService.create(request));
    }

    @PutMapping("/{studentId}")
    public ResponseEntity<?> update(@PathVariable String studentId, @RequestBody StudentRequest request, Authentication auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(studentAdminService.update(studentId, request));
    }

    /** The student edits their own profile (an admin may edit anyone's) */
    @PutMapping("/{studentId}/profile")
    public ResponseEntity<?> updateProfile(@PathVariable String studentId, @RequestBody StudentProfileRequest request,
                                           Authentication auth) {
        boolean self = CurrentUser.studentId(auth).map(studentId::equals).orElse(false);
        if (!self && !CurrentUser.isAdmin(auth)) {
            throw new StudentAdminException(HttpStatus.FORBIDDEN, "แก้ไขได้เฉพาะข้อมูลส่วนตัวของตนเอง");
        }
        return ResponseEntity.ok(studentAdminService.updateProfile(studentId, request));
    }

    /** Admin: the student's password becomes their student id and must be changed at the next login */
    @PostMapping("/{studentId}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String studentId, Authentication auth) {
        requireAdmin(auth);
        try {
            accountService.resetStudentPassword(studentId);
        } catch (AccountException e) {
            throw new StudentAdminException(e.getStatus(), e.getMessage());
        }
        return ResponseEntity.ok(Map.of("message", "รีเซ็ตรหัสผ่านของ " + studentId + " แล้ว รหัสผ่านใหม่คือรหัสนักศึกษา (ต้องเปลี่ยนเมื่อเข้าสู่ระบบ)"));
    }

    @DeleteMapping("/{studentId}")
    public ResponseEntity<?> delete(@PathVariable String studentId, Authentication auth) {
        requireAdmin(auth);
        studentAdminService.delete(studentId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(StudentAdminException.class)
    public ResponseEntity<Map<String, String>> handle(StudentAdminException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private static void requireAdmin(Authentication auth) {
        if (!CurrentUser.isAdmin(auth)) {
            throw new StudentAdminException(HttpStatus.FORBIDDEN, "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลนักศึกษาได้");
        }
    }
}
