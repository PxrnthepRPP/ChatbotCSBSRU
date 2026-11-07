package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.model.AdvisingNote;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AdvisorInsightService;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import com.bsru.studentportal.service.StudentCsvService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The logged-in advisor's own advisees: real records, history and risk check. */
@RestController
@RequestMapping("/api/advisors/me")
public class AdvisorController {

    private final AdvisorInsightService insights;
    private final AdvisorRepository advisorRepository;
    private final StudentAdminService studentAdminService;
    private final AdvisingNoteRepository advisingNoteRepository;
    private final StudentRepository studentRepository;
    private final StudentCsvService studentCsvService;

    @Autowired
    public AdvisorController(AdvisorInsightService insights,
                             AdvisorRepository advisorRepository,
                             StudentAdminService studentAdminService,
                             AdvisingNoteRepository advisingNoteRepository,
                             StudentRepository studentRepository,
                             StudentCsvService studentCsvService) {
        this.insights = insights;
        this.advisorRepository = advisorRepository;
        this.studentAdminService = studentAdminService;
        this.advisingNoteRepository = advisingNoteRepository;
        this.studentRepository = studentRepository;
        this.studentCsvService = studentCsvService != null
                ? studentCsvService
                : new StudentCsvService(studentRepository, advisorRepository, null);
    }

    public AdvisorController(AdvisorInsightService insights,
                             AdvisorRepository advisorRepository,
                             StudentAdminService studentAdminService,
                             AdvisingNoteRepository advisingNoteRepository,
                             StudentRepository studentRepository) {
        this(insights, advisorRepository, studentAdminService, advisingNoteRepository, studentRepository, null);
    }

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

    /** Advisor imports students into their own cohort / advisees via CSV */
    @PostMapping(value = "/advisees/import-csv", consumes = {"*/*"})
    public ResponseEntity<?> importAdviseesCsv(
            @RequestBody(required = false) String rawBody,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpServletRequest request,
            Authentication auth) throws Exception {
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) return forbidden();
        Map<String, Object> result = studentCsvService.processCsvImport(rawBody, file, request, advisorId.get());
        return ResponseEntity.ok(result);
    }

    // ------------------------------------------------------------------ advising notes

    @GetMapping("/advisees/{studentId}/notes")
    public ResponseEntity<?> listNotes(@PathVariable String studentId, Authentication auth) {
        ResponseEntity<?> denied = verifyAdviseeAccess(auth, studentId);
        if (denied != null) return denied;
        List<AdvisingNote> notes = advisingNoteRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
        return ResponseEntity.ok(notes);
    }

    @PostMapping("/advisees/{studentId}/notes")
    public ResponseEntity<?> createNote(@PathVariable String studentId,
                                        @RequestBody Map<String, Object> body,
                                        Authentication auth) {
        ResponseEntity<?> denied = verifyAdviseeAccess(auth, studentId);
        if (denied != null) return denied;

        String summary = body != null && body.get("summary") != null ? body.get("summary").toString().trim() : "";
        if (summary.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "กรุณาระบุบันทึกการให้คำปรึกษา"));
        }

        String advisorId = CurrentUser.advisorId(auth).orElseGet(() -> {
            if (CurrentUser.isAdmin(auth)) {
                return studentRepository.findById(studentId)
                        .map(s -> s.getAdvisor() != null ? s.getAdvisor().getId() : "ADV-ADMIN")
                        .orElse("ADV-ADMIN");
            }
            return "UNKNOWN";
        });

        LocalDate followUpDate = null;
        if (body != null && body.get("followUpDate") != null) {
            String fDateStr = body.get("followUpDate").toString().trim();
            if (!fDateStr.isEmpty()) {
                try {
                    followUpDate = LocalDate.parse(fDateStr.length() > 10 ? fDateStr.substring(0, 10) : fDateStr);
                } catch (DateTimeParseException e) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "รูปแบบวันที่ติดตามผลไม่ถูกต้อง (yyyy-MM-dd)"));
                }
            }
        }

        String riskLevelSnapshot = (body != null && body.get("riskLevelSnapshot") != null)
                ? body.get("riskLevelSnapshot").toString().trim()
                : null;

        AdvisingNote note = new AdvisingNote();
        note.setStudentId(studentId);
        note.setAdvisorId(advisorId);
        note.setSummary(summary);
        note.setFollowUpDate(followUpDate);
        note.setRiskLevelSnapshot(riskLevelSnapshot);
        note.setCreatedAt(LocalDateTime.now());

        AdvisingNote saved = advisingNoteRepository.save(note);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/advisees/{studentId}/notes/{noteId}")
    public ResponseEntity<?> deleteNote(@PathVariable String studentId,
                                        @PathVariable Long noteId,
                                        Authentication auth) {
        ResponseEntity<?> denied = verifyAdviseeAccess(auth, studentId);
        if (denied != null) return denied;

        Optional<AdvisingNote> noteOpt = advisingNoteRepository.findById(noteId);
        if (noteOpt.isEmpty() || !noteOpt.get().getStudentId().equals(studentId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบบันทึกการให้คำปรึกษา"));
        }

        advisingNoteRepository.delete(noteOpt.get());
        return ResponseEntity.ok(Map.of("success", true, "message", "ลบบันทึกการให้คำปรึกษาสำเร็จ"));
    }

    private ResponseEntity<?> verifyAdviseeAccess(Authentication auth, String studentId) {
        if (CurrentUser.isAdmin(auth)) {
            if (!studentRepository.existsById(studentId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "ไม่พบนักศึกษารหัส " + studentId));
            }
            return null;
        }
        Optional<String> advisorId = CurrentUser.advisorId(auth);
        if (advisorId.isEmpty()) {
            return forbidden();
        }
        Optional<Student> studentOpt = studentRepository.findById(studentId);
        if (studentOpt.isEmpty() || studentOpt.get().getAdvisor() == null
                || !studentOpt.get().getAdvisor().getId().equals(advisorId.get())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "นักศึกษารหัส " + studentId + " ไม่ได้อยู่ในความดูแลของคุณ"));
        }
        return null;
    }

    @ExceptionHandler(StudentAdminException.class)
    public ResponseEntity<Map<String, String>> handle(StudentAdminException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    private static ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะอาจารย์ที่ปรึกษาเท่านั้น"));
    }
}
