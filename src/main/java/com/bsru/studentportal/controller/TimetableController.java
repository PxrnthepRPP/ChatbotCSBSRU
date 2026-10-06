package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.EnrollmentReviewRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.dto.RegistrationPeriodRequest;
import com.bsru.studentportal.dto.SectionRequest;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.TimetableService;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Timetable API.
 * Students: read their own timetable, add/drop courses while registration is open.
 * Teachers (advisors): manage the sections they teach and who is enrolled in them.
 * Admins: everything, including opening and closing registration.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class TimetableController {

    private final TimetableService timetableService;

    @GetMapping("/students/{studentId}/timetable")
    public ResponseEntity<?> getTimetable(@PathVariable String studentId, Authentication auth) {
        Actor actor = actor(auth);
        if (actor.kind() == Actor.Kind.STUDENT && !actor.id().equals(studentId)) {
            throw new TimetableException(HttpStatus.FORBIDDEN, "นักศึกษาดูได้เฉพาะตารางเรียนของตนเอง");
        }
        return ResponseEntity.ok(timetableService.timetableOf(studentId));
    }

    @PostMapping("/students/{studentId}/enrollments")
    public ResponseEntity<?> enroll(@PathVariable String studentId, @RequestBody EnrollmentRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableService.enroll(actor(auth), studentId, request));
    }

    /** Check a cart of course codes: the section of the student's Sec, seats left, clashes. Saves nothing. */
    @PostMapping("/students/{studentId}/registration/check")
    public ResponseEntity<?> checkRegistration(@PathVariable String studentId, @RequestBody RegistrationCartRequest request,
                                               Authentication auth) {
        return ResponseEntity.ok(timetableService.checkRegistration(actor(auth), studentId, request));
    }

    /** Send the whole cart; all-or-nothing. Students' requests wait for an admin to confirm. */
    @PostMapping("/students/{studentId}/registration")
    public ResponseEntity<?> submitRegistration(@PathVariable String studentId, @RequestBody RegistrationCartRequest request,
                                                Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableService.submitRegistration(actor(auth), studentId, request));
    }

    @PutMapping("/students/{studentId}/section")
    public ResponseEntity<?> setStudentSection(@PathVariable String studentId, @RequestBody Map<String, String> body,
                                               Authentication auth) {
        return ResponseEntity.ok(timetableService.setStudentSection(actor(auth), studentId, body.get("studentSection")));
    }

    @GetMapping("/enrollments/pending")
    public ResponseEntity<?> pendingRequests(Authentication auth) {
        return ResponseEntity.ok(timetableService.pendingRequests(actor(auth)));
    }

    @PatchMapping("/enrollments/review")
    public ResponseEntity<?> reviewRequests(@RequestBody EnrollmentReviewRequest request, Authentication auth) {
        return ResponseEntity.ok(Map.of("updated", timetableService.reviewRequests(actor(auth), request)));
    }

    @DeleteMapping("/students/{studentId}/enrollments/{sectionId}")
    public ResponseEntity<?> drop(@PathVariable String studentId, @PathVariable Long sectionId, Authentication auth) {
        return ResponseEntity.ok(timetableService.drop(actor(auth), studentId, sectionId));
    }

    @GetMapping("/sections")
    public ResponseEntity<?> listSections(@RequestParam(required = false) Integer academicYear,
                                          @RequestParam(required = false) Integer term) {
        return ResponseEntity.ok(timetableService.listSections(academicYear, term));
    }

    @GetMapping("/sections/mine")
    public ResponseEntity<?> mySections(Authentication auth) {
        return ResponseEntity.ok(timetableService.sectionsManagedBy(actor(auth)));
    }

    /** Open a course with one or both Secs at once (all-or-nothing) */
    @PostMapping("/sections/batch")
    public ResponseEntity<?> createSections(@RequestBody List<SectionRequest> requests, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableService.createSections(actor(auth), requests));
    }

    @PostMapping("/sections")
    public ResponseEntity<?> createSection(@RequestBody SectionRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableService.createSection(actor(auth), request));
    }

    @PutMapping("/sections/{sectionId}")
    public ResponseEntity<?> updateSection(@PathVariable Long sectionId, @RequestBody SectionRequest request, Authentication auth) {
        return ResponseEntity.ok(timetableService.updateSection(actor(auth), sectionId, request));
    }

    @DeleteMapping("/sections/{sectionId}")
    public ResponseEntity<?> deleteSection(@PathVariable Long sectionId, Authentication auth) {
        timetableService.deleteSection(actor(auth), sectionId);
        return ResponseEntity.noContent().build();
    }

    /** Admin decision on a teacher's request: {"status": "APPROVED" | "REJECTED", "note": "..."} */
    @PatchMapping("/sections/{sectionId}/review")
    public ResponseEntity<?> reviewSection(@PathVariable Long sectionId, @RequestBody Map<String, String> body,
                                           Authentication auth) {
        return ResponseEntity.ok(timetableService.reviewSection(actor(auth), sectionId, body.get("status"), body.get("note")));
    }

    @GetMapping("/sections/{sectionId}/students")
    public ResponseEntity<?> sectionStudents(@PathVariable Long sectionId, Authentication auth) {
        return ResponseEntity.ok(timetableService.studentsInSection(actor(auth), sectionId));
    }

    @GetMapping("/registration-periods")
    public ResponseEntity<?> listPeriods() {
        return ResponseEntity.ok(timetableService.listPeriods());
    }

    @PutMapping("/registration-periods")
    public ResponseEntity<?> savePeriod(@RequestBody RegistrationPeriodRequest request, Authentication auth) {
        return ResponseEntity.ok(timetableService.savePeriod(actor(auth), request));
    }

    @ExceptionHandler(TimetableException.class)
    public ResponseEntity<Map<String, Object>> handle(TimetableException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        if (e.getDetails() != null) body.put("details", e.getDetails());
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    private static Actor actor(Authentication auth) {
        if (CurrentUser.isAdmin(auth)) return new Actor(Actor.Kind.ADMIN, auth.getName());
        return CurrentUser.advisorId(auth).map(id -> new Actor(Actor.Kind.ADVISOR, id))
                .or(() -> CurrentUser.studentId(auth).map(id -> new Actor(Actor.Kind.STUDENT, id)))
                .orElseThrow(() -> new TimetableException(HttpStatus.UNAUTHORIZED, "กรุณาเข้าสู่ระบบ"));
    }
}
