package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AdvisorInsightService;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** The logged-in advisor's own advisees: real records, history and risk check. */
@RestController
@RequestMapping("/api/advisors/me")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdvisorController {

    private final AdvisorInsightService insights;
    private final AdvisorRepository advisorRepository;
    private final StudentAdminService studentAdminService;

    @GetMapping
    public ResponseEntity<?> me(Authentication auth) {
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) return forbidden();
        Map<String, Object> body = new LinkedHashMap<>();
        advisorRepository.findById(advisorId.get()).ifPresent(a -> {
            body.put("id", a.getId());
            body.put("nameTh", a.getNameTh());
            body.put("nameEn", a.getNameEn());
            body.put("email", a.getEmail());
        });
        body.put("riskCriteria", AdvisorInsightService.criteriaText());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/advisees")
    public ResponseEntity<?> advisees(Authentication auth) {
        return CurrentUser.advisorId(auth)
                .<ResponseEntity<?>>map(id -> ResponseEntity.ok(insights.risksOf(id)))
                .orElseGet(AdvisorController::forbidden);
    }

    @GetMapping("/advisees/{studentId}")
    public ResponseEntity<?> advisee(@PathVariable String studentId, Authentication auth) {
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) return forbidden();
        return insights.detailOf(advisorId.get(), studentId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "นักศึกษารหัส " + studentId + " ไม่ได้อยู่ในความดูแลของคุณ")));
    }

    /** Add a sample (simulated) student to my advisees: basic data only, no login, no grades */
    @PostMapping("/advisees")
    public ResponseEntity<?> addSimulated(@RequestBody StudentRequest request, Authentication auth) {
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) return forbidden();
        return ResponseEntity.status(HttpStatus.CREATED).body(studentAdminService.createSimulatedForAdvisor(advisorId.get(), request));
    }

    /** Delete one of my simulated students */
    @DeleteMapping("/advisees/{studentId}")
    public ResponseEntity<?> deleteSimulated(@PathVariable String studentId, Authentication auth) {
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) return forbidden();
        studentAdminService.deleteSimulatedForAdvisor(advisorId.get(), studentId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(StudentAdminException.class)
    public ResponseEntity<Map<String, String>> handle(StudentAdminException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะอาจารย์ที่ปรึกษาเท่านั้น"));
    }
}
