package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.dto.RegistrationPeriodRequest;
import com.bsru.studentportal.dto.SectionRequest;
import com.bsru.studentportal.dto.SelfRegistrationRequest;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.TimetableService;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import lombok.RequiredArgsConstructor;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Timetable API.
 * Students: read their own timetable, register courses themselves (no approval) and drop them while registration is open.
 * Teachers (advisors): manage the sections they teach and who is enrolled in them.
 * Admins: everything, including opening and closing registration and the registration log.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
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

    /** Admin: every registration (newest first), optionally only one semester */
    @GetMapping("/enrollments")
    public ResponseEntity<?> registrationLog(@RequestParam(required = false) Integer academicYear,
                                             @RequestParam(required = false) Integer term, Authentication auth) {
        return ResponseEntity.ok(timetableService.registrationLog(actor(auth), academicYear, term));
    }

    /** Student registers a course by typing it in; confirmed straight away. 409 + the existing section when already recorded. */
    @PostMapping("/students/{studentId}/self-registration")
    public ResponseEntity<?> selfRegister(@PathVariable String studentId, @RequestBody SelfRegistrationRequest request,
                                          Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(timetableService.selfRegister(actor(auth), studentId, request));
    }

    /** Courses recorded before that match a code prefix or part of a name, to fill in the registration form */
    @GetMapping("/courses/suggestions")
    public ResponseEntity<?> courseSuggestions(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(timetableService.courseSuggestions(q));
    }

    /** Sections of one course already recorded in a semester (duplicate warning in the form) */
    @GetMapping("/sections/lookup")
    public ResponseEntity<?> sectionsOfCourse(@RequestParam Integer academicYear, @RequestParam Integer term,
                                              @RequestParam String courseCode) {
        return ResponseEntity.ok(timetableService.sectionsOfCourse(academicYear, term, courseCode));
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
