package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only: a student's activity record (activities done / required), the same numbers the
 * graduation page and the chatbot read. Creates the record when the student has none yet.
 */
@RestController
@RequestMapping("/api/students/{studentId}/activity")
@RequiredArgsConstructor
public class ActivityController {

    private final GraduationProgressRepository progressRepository;
    private final StudentRepository studentRepository;

    /** Body: {"completed": 4, "required": 6} */
    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@PathVariable String studentId, @RequestBody Map<String, Integer> body, Authentication auth) {
        if (!CurrentUser.isAdmin(auth)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้น"));
        }
        if (!studentRepository.existsById(studentId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "ไม่พบนักศึกษารหัส " + studentId));
        }
        Integer completed = body.get("completed");
        Integer required = body.get("required");
        if (completed == null || required == null || completed < 0 || required < 1 || completed > required) {
            return ResponseEntity.badRequest().body(Map.of("error", "กิจกรรมที่ผ่านต้องอยู่ระหว่าง 0 ถึงจำนวนที่ต้องผ่าน (อย่างน้อย 1)"));
        }
        GraduationProgress g = progressRepository.findById(studentId).orElseGet(() -> {
            // Credit fields are not used by the pages (the graduation audit holds credits); zero until set
            GraduationProgress p = new GraduationProgress();
            p.setStudentId(studentId);
            p.setCoreRequired(0);
            p.setCoreEarned(0);
            p.setGeRequired(0);
            p.setGeEarned(0);
            p.setElectiveRequired(0);
            p.setElectiveEarned(0);
            p.setFreeRequired(0);
            p.setFreeEarned(0);
            p.setGpaRequired(2.0);
            p.setStatus("กำลังดำเนินการ");
            return p;
        });
        g.setActivityCompleted(completed);
        g.setActivityRequired(required);
        progressRepository.save(g);
        return ResponseEntity.ok(Map.of("studentId", studentId, "completed", completed, "required", required));
    }
}
