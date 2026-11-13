package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.StudentProfileRequest;
import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.AccountService.AccountException;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import com.bsru.studentportal.service.StudentCsvService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/** Admin-only create / update / delete of students, saved to the database. */
@RestController
@RequestMapping("/api/students")
public class StudentAdminController {

    private final StudentAdminService studentAdminService;
    private final AccountService accountService;
    private final StudentRepository studentRepository;
    private final AdvisingNoteRepository advisingNoteRepository;
    private final StudentCsvService studentCsvService;

    @Autowired
    public StudentAdminController(
            StudentAdminService studentAdminService,
            AccountService accountService,
            StudentRepository studentRepository,
            AdvisorRepository advisorRepository,
            AdvisingNoteRepository advisingNoteRepository,
            StudentCsvService studentCsvService) {
        this.studentAdminService = studentAdminService;
        this.accountService = accountService;
        this.studentRepository = studentRepository;
        this.advisingNoteRepository = advisingNoteRepository;
        this.studentCsvService = studentCsvService != null
                ? studentCsvService
                : new StudentCsvService(studentRepository, advisorRepository, accountService);
    }

    public StudentAdminController(
            StudentAdminService studentAdminService,
            AccountService accountService,
            StudentRepository studentRepository,
            AdvisorRepository advisorRepository,
            AdvisingNoteRepository advisingNoteRepository) {
        this(studentAdminService, accountService, studentRepository, advisorRepository, advisingNoteRepository,
                new StudentCsvService(studentRepository, advisorRepository, accountService));
    }

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

    /** Admin only: the full national ID (every other response carries only the masked form) */
    @GetMapping("/{studentId}/national-id")
    public ResponseEntity<?> nationalId(@PathVariable String studentId, Authentication auth) {
        requireAdmin(auth);
        Student s = studentRepository.findById(studentId)
                .orElseThrow(() -> new StudentAdminException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId));
        Map<String, Object> body = new HashMap<>();
        body.put("studentId", studentId);
        body.put("nationalId", s.getNationalId());
        return ResponseEntity.ok(body);
    }

    /** Admin: the student's password goes back to the default (initials + national ID) and must be changed at the next login */
    @PostMapping("/{studentId}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String studentId, Authentication auth) {
        requireAdmin(auth);
        String password;
        try {
            password = accountService.resetStudentPassword(studentId);
        } catch (AccountException e) {
            throw new StudentAdminException(e.getStatus(), e.getMessage());
        }
        return ResponseEntity.ok(Map.of("message", "รีเซ็ตรหัสผ่านของ " + studentId + " แล้ว รหัสผ่านใหม่คือ " + password
                + " (ต้องเปลี่ยนเมื่อเข้าสู่ระบบ)", "initialPassword", password));
    }

    @DeleteMapping("/{studentId}")
    public ResponseEntity<?> delete(@PathVariable String studentId, Authentication auth) {
        requireAdmin(auth);
        if (advisingNoteRepository != null) {
            advisingNoteRepository.deleteByStudentId(studentId);
        }
        studentAdminService.delete(studentId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ CSV Bulk Import & Export

    @PostMapping(value = "/import-csv", consumes = {"*/*"})
    public ResponseEntity<?> importCsv(
            @RequestBody(required = false) String rawBody,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpServletRequest request,
            Authentication auth) throws Exception {
        requireAdmin(auth);
        return processCsvImport(rawBody, file, request, null);
    }

    public ResponseEntity<?> importCsvForAdvisor(
            String rawBody,
            MultipartFile file,
            HttpServletRequest request,
            String advisorId) throws Exception {
        return processCsvImport(rawBody, file, request, advisorId);
    }

    public ResponseEntity<?> processCsvImport(
            String rawBody,
            MultipartFile file,
            HttpServletRequest request,
            String assignedAdvisorId) throws Exception {
        Map<String, Object> result = studentCsvService.processCsvImport(rawBody, file, request, assignedAdvisorId);
        return ResponseEntity.ok(result);
    }

    @GetMapping(value = {"/export-csv", "/csv"}, produces = "text/csv; charset=UTF-8")
    public ResponseEntity<byte[]> exportCsv(Authentication auth) throws Exception {
        requireAdmin(auth);
        byte[] csvData = studentCsvService.exportCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=UTF-8")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"students_bsru.csv\"")
                .body(csvData);
    }

    public static LocalDate parseFlexibleDate(String text) {
        return StudentCsvService.parseFlexibleDate(text);
    }

    @ExceptionHandler(StudentAdminException.class)
    public ResponseEntity<Map<String, String>> handle(StudentAdminException e) {
        return ResponseEntity.status(e.getStatus().value())
                .body(Map.of("error", Objects.requireNonNullElse(e.getMessage(), "")));
    }

    private static void requireAdmin(Authentication auth) {
        if (!CurrentUser.isAdmin(auth)) {
            throw new StudentAdminException(HttpStatus.FORBIDDEN, "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลนักศึกษาได้");
        }
    }
}
