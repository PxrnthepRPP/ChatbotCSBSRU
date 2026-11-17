package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.ActivityRegisterRequest;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.StudentActivity;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.StudentActivityService;
import com.bsru.studentportal.service.StudentActivityService.ActivityCriterion;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Student Activities Controller:
 * Handles activity self-registration by students, activity transcript listing,
 * deletion, and admin graduation progress sync.
 */
@RestController
@RequiredArgsConstructor
public class ActivityController {

    private final GraduationProgressRepository progressRepository;
    private final StudentRepository studentRepository;
    private final StudentActivityService activityService;

    /**
     * Get all activities of a student.
     */
    @GetMapping("/api/students/{studentId}/activities")
    public ResponseEntity<List<StudentActivity>> getActivities(@PathVariable String studentId, Authentication auth) {
        checkAccess(studentId, auth, false);
        return ResponseEntity.ok(activityService.getActivities(studentId));
    }

    /**
     * Get the 17 official BSRU activity criteria.
     */
    @GetMapping("/api/activities/criteria")
    public ResponseEntity<List<ActivityCriterion>> getCriteria() {
        return ResponseEntity.ok(StudentActivityService.BSRU_CRITERIA);
    }

    /**
     * Student self-registration of an activity.
     */
    @PostMapping("/api/students/{studentId}/activities")
    public ResponseEntity<StudentActivity> registerActivity(
            @PathVariable String studentId,
            @RequestBody ActivityRegisterRequest request,
            Authentication auth) {
        checkAccess(studentId, auth, true);
        StudentActivity saved = activityService.registerActivity(studentId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Student or admin deletes an activity.
     */
    @DeleteMapping("/api/students/{studentId}/activities/{activityId}")
    public ResponseEntity<?> deleteActivity(
            @PathVariable String studentId,
            @PathVariable Long activityId,
            Authentication auth) {
        checkAccess(studentId, auth, true);
        activityService.deleteActivity(studentId, activityId);
        return ResponseEntity.ok(Map.of("message", "ลบกิจกรรมเรียบร้อยแล้ว", "activityId", activityId));
    }

    /**
     * Legacy/Admin endpoint: update completed / required count in GraduationProgress.
     * Body: {"completed": 4, "required": 6}
     */
    @PutMapping("/api/students/{studentId}/activity")
    @Transactional
    public ResponseEntity<?> save(
            @PathVariable String studentId,
            @RequestBody Map<String, Integer> body,
            Authentication auth) {
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

    private void checkAccess(String studentId, Authentication auth, boolean requireStudentOrAdmin) {
        if (CurrentUser.isAdmin(auth)) return;
        Optional<String> callerStudentId = CurrentUser.studentId(auth);
        if (callerStudentId.isPresent() && callerStudentId.get().equalsIgnoreCase(studentId)) return;
        if (!requireStudentOrAdmin && CurrentUser.advisorId(auth).isPresent()) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ไม่มีสิทธิ์เข้าถึงหรือจัดการข้อมูลของนักศึกษาคนอื่น");
    }
}
