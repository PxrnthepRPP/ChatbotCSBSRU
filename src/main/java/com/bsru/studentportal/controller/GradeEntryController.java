package com.bsru.studentportal.controller;

import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.GradeEntryService;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;

/** Teachers enter and send grades of their sections; the admin sets deadlines and releases courses. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GradeEntryController {

    private final GradeEntryService gradeEntryService;

    @GetMapping("/sections/{sectionId}/grades")
    public ResponseEntity<?> sectionGrades(@PathVariable Long sectionId, Authentication auth) {
        return ResponseEntity.ok(gradeEntryService.sectionGrades(actor(auth), sectionId));
    }

    /** Body: {"grades": {"6421100042": "A", "6521100088": ""}} — "" clears a grade */
    @PutMapping("/sections/{sectionId}/grades")
    public ResponseEntity<?> saveGrades(@PathVariable Long sectionId, @RequestBody Map<String, Map<String, String>> body,
                                        Authentication auth) {
        return ResponseEntity.ok(gradeEntryService.saveGrades(actor(auth), sectionId, body.get("grades")));
    }

    @PostMapping("/sections/{sectionId}/grades/submit")
    public ResponseEntity<?> submit(@PathVariable Long sectionId, Authentication auth) {
        return ResponseEntity.ok(gradeEntryService.submit(actor(auth), sectionId));
    }

    @GetMapping("/grade-schedules")
    public ResponseEntity<?> courseStatuses(Authentication auth) {
        return ResponseEntity.ok(gradeEntryService.courseStatuses(actor(auth)));
    }

    /**
     * Body: {"academicYear": 2565, "term": 2, "courseCode": "CS3201",
     *        "submitDeadline": "2026-10-20T23:59", "releaseAt": "2026-10-25T09:00"} — null or "" clears,
     * "now" as releaseAt releases at once
     */
    @PutMapping("/grade-schedules")
    public ResponseEntity<?> saveSchedule(@RequestBody Map<String, Object> body, Authentication auth) {
        int year = number(body.get("academicYear"), "academicYear");
        int term = number(body.get("term"), "term");
        return ResponseEntity.ok(gradeEntryService.saveSchedule(actor(auth), year, term,
                (String) body.get("courseCode"), dateTime(body.get("submitDeadline")), dateTime(body.get("releaseAt"))));
    }

    @ExceptionHandler(TimetableException.class)
    public ResponseEntity<Map<String, Object>> handle(TimetableException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private static int number(Object value, String name) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาระบุ " + name);
        }
    }

    private static LocalDateTime dateTime(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        String text = String.valueOf(value).trim();
        if ("now".equalsIgnoreCase(text)) return LocalDateTime.now();
        try {
            return LocalDateTime.parse(text.length() == 16 ? text + ":00" : text);
        } catch (DateTimeParseException e) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "รูปแบบวันเวลาไม่ถูกต้อง: " + text);
        }
    }

    private static Actor actor(Authentication auth) {
        if (CurrentUser.isAdmin(auth)) return new Actor(Actor.Kind.ADMIN, auth.getName());
        return CurrentUser.advisorId(auth).map(id -> new Actor(Actor.Kind.ADVISOR, id))
                .or(() -> CurrentUser.studentId(auth).map(id -> new Actor(Actor.Kind.STUDENT, id)))
                .orElseThrow(() -> new TimetableException(HttpStatus.UNAUTHORIZED, "กรุณาเข้าสู่ระบบ"));
    }
}
