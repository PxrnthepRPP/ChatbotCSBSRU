package com.bsru.studentportal.controller;

import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.CohortAdvisorService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Admin-only: the advisor of each cohort (admission year) */
@RestController
@RequestMapping("/api/cohort-advisors")
@RequiredArgsConstructor
public class CohortAdvisorController {

    private final CohortAdvisorService cohortAdvisorService;

    @GetMapping
    public ResponseEntity<?> list(Authentication auth) {
        if (!CurrentUser.isAdmin(auth)) return forbidden();
        return ResponseEntity.ok(cohortAdvisorService.list());
    }

    /** Body: {"advisorId": "ADV-01"}; a blank id removes the cohort's advisor */
    @PutMapping("/{admissionYear}")
    public ResponseEntity<?> assign(@PathVariable int admissionYear, @RequestBody Map<String, String> body,
                                    Authentication auth) {
        if (!CurrentUser.isAdmin(auth)) return forbidden();
        return ResponseEntity.ok(cohortAdvisorService.assign(admissionYear, body.get("advisorId")));
    }

    @ExceptionHandler(StudentAdminException.class)
    public ResponseEntity<Map<String, String>> handle(StudentAdminException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้น"));
    }
}
