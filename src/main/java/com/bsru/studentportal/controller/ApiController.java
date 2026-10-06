package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.CareerUpdateRequest;
import com.bsru.studentportal.dto.PetitionRequest;
import com.bsru.studentportal.dto.PetitionStatusUpdateRequest;
import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AcademicRecordService;
import com.bsru.studentportal.service.GraduationAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.Year;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ApiController {

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final AcademicRecordService academicRecordService;
    private final GraduationAuditService graduationAuditService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "BSRU Student Portal Backend");
        response.put("database", "PostgreSQL + pgvector");
        response.put("studentsCount", studentRepository.count());
        response.put("advisorsCount", advisorRepository.count());
        response.put("petitionsCount", petitionRepository.count());
        return ResponseEntity.ok(response);
    }

    /** All students: staff only (students used to be able to list everyone) */
    @GetMapping("/students")
    public ResponseEntity<?> getAllStudents(Authentication authentication) {
        if (CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.ok(studentRepository.findAll());
        }
        // Advisors see the students they advise
        Optional<String> advisorId = CurrentUser.advisorId(authentication);
        if (advisorId.isPresent()) {
            return ResponseEntity.ok(studentRepository.findAll().stream()
                    .filter(s -> s.getAdvisor() != null && advisorId.get().equals(s.getAdvisor().getId()))
                    .toList());
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะอาจารย์และผู้ดูแลระบบเท่านั้น"));
    }

    @GetMapping("/students/{studentId}")
    public ResponseEntity<?> getStudentById(@PathVariable String studentId, Authentication authentication) {
        if (!canViewRecordsOf(studentId, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Students can only view their own profile"));
        }
        return studentRepository.findById(Objects.requireNonNull(studentId))
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/students/{studentId}/grades")
    public ResponseEntity<?> getStudentGrades(@PathVariable String studentId, Authentication authentication) {
        if (!canViewRecordsOf(studentId, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Students can only view their own grades"));
        }
        return ResponseEntity.ok(academicRecordService.gradesOf(studentId));
    }

    /** The full graduation audit (curriculum tree + computed pass/fail + summary); same data the chatbot reads */
    @GetMapping("/students/{studentId}/graduation-audit")
    public ResponseEntity<?> getGraduationAudit(@PathVariable String studentId, Authentication authentication) {
        if (!canViewRecordsOf(studentId, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Students can only view their own graduation audit"));
        }
        return graduationAuditService.auditOf(studentId)
                .<ResponseEntity<?>>map(r -> ResponseEntity.ok(r.audit()))
                .orElse(ResponseEntity.notFound().build());
    }

    /** Admin: the stored sheet without computed fields, to download and use as a template */
    @GetMapping(value = "/students/{studentId}/graduation-audit/raw", produces = "application/json")
    public ResponseEntity<?> getGraduationAuditRaw(@PathVariable String studentId, Authentication authentication) {
        if (!CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้น"));
        }
        return graduationAuditService.rawOf(studentId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "นักศึกษารหัส " + studentId + " ยังไม่มีใบตรวจสอบจบ")));
    }

    /** Admin: upload / replace a student's graduation audit sheet (same JSON format as graduation/*.json) */
    @PutMapping(value = "/students/{studentId}/graduation-audit", consumes = "application/json")
    public ResponseEntity<?> putGraduationAudit(@PathVariable String studentId, @RequestBody String json,
                                                Authentication authentication) {
        if (!CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้น"));
        }
        if (!studentRepository.existsById(studentId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "ไม่พบนักศึกษารหัส " + studentId));
        }
        try {
            return ResponseEntity.ok(graduationAuditService.save(studentId, json).audit().get("summary"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/students/{studentId}/graduation-progress")
    public ResponseEntity<?> getGraduationProgress(@PathVariable String studentId, Authentication authentication) {
        if (!canViewRecordsOf(studentId, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Students can only view their own graduation progress"));
        }
        GraduationProgress g = academicRecordService.graduationOf(studentId).orElse(null);
        if (g == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("studentId", studentId);
        body.put("requiredCredits", g.requiredCredits());
        body.put("earnedCredits", g.earnedCredits());
        body.put("coreRequired", g.getCoreRequired());
        body.put("coreEarned", g.getCoreEarned());
        body.put("geRequired", g.getGeRequired());
        body.put("geEarned", g.getGeEarned());
        body.put("electiveRequired", g.getElectiveRequired());
        body.put("electiveEarned", g.getElectiveEarned());
        body.put("freeRequired", g.getFreeRequired());
        body.put("freeEarned", g.getFreeEarned());
        body.put("gpaRequired", g.getGpaRequired());
        body.put("currentGpa", academicRecordService.gradesOf(studentId).gpa());
        body.put("activityRequired", g.getActivityRequired());
        body.put("activityCompleted", g.getActivityCompleted());
        body.put("status", g.getStatus());
        return ResponseEntity.ok(body);
    }

    /** Advisors and admins may view any student; a student only their own records. */
    /** Admins may view any student, an advisor only their own advisees, a student only themselves. */
    private boolean canViewRecordsOf(String studentId, Authentication authentication) {
        if (CurrentUser.isAdmin(authentication)) return true;
        Optional<String> advisorId = CurrentUser.advisorId(authentication);
        if (advisorId.isPresent()) {
            return studentRepository.findById(studentId)
                    .map(s -> s.getAdvisor() != null && advisorId.get().equals(s.getAdvisor().getId()))
                    .orElse(false);
        }
        return CurrentUser.studentId(authentication).map(studentId::equals).orElse(false);
    }

    @GetMapping("/advisors")
    public List<Advisor> getAllAdvisors() {
        return advisorRepository.findAll();
    }

    @GetMapping("/petitions")
    public List<AcademicPetition> getAllPetitions() {
        return petitionRepository.findAll();
    }

    @PostMapping("/petitions")
    public ResponseEntity<?> submitPetition(@RequestBody PetitionRequest request) {
        if (request.getStudentId() == null || request.getTitle() == null || request.getType() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "studentId, title, and type are required"));
        }

        String studentId = request.getStudentId();
        // Fetch student or fallback to first student
        Student student = studentRepository.findById(Objects.requireNonNull(studentId))
                .orElse(null);

        if (student == null) {
            List<Student> all = studentRepository.findAll();
            if (!all.isEmpty()) {
                student = all.get(0);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Student not found with ID: " + studentId));
            }
        }

        int yearBE = Year.now().getValue() + 543;
        String petitionId = String.format("PET-%d-%03d", yearBE, petitionRepository.count() + 1);

        AcademicPetition petition = new AcademicPetition();
        petition.setId(petitionId);
        petition.setType(request.getType());
        petition.setTitle(request.getTitle());
        petition.setDetails(request.getDetails());
        petition.setAttachment(request.getAttachment());
        petition.setSubmittedAt(LocalDateTime.now());
        petition.setStatus("รอดำเนินการ");
        petition.setAdminComment(null);
        petition.setStudent(student);

        AcademicPetition saved = petitionRepository.save(petition);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/petitions/{id}/status")
    public ResponseEntity<?> updatePetitionStatus(
            @PathVariable String id,
            @RequestBody PetitionStatusUpdateRequest request) {

        AcademicPetition petition = petitionRepository.findById(Objects.requireNonNull(id)).orElse(null);
        if (petition == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Petition not found with ID: " + id));
        }

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            petition.setStatus(request.getStatus());
        }
        if (request.getAdminComment() != null) {
            petition.setAdminComment(request.getAdminComment());
        }

        AcademicPetition updated = petitionRepository.save(petition);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/students/{studentId}/career")
    public ResponseEntity<?> updateStudentCareer(
            @PathVariable String studentId,
            @RequestBody CareerUpdateRequest request) {

        Student student = studentRepository.findById(Objects.requireNonNull(studentId)).orElse(null);
        if (student == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Student not found with ID: " + studentId));
        }

        if (request.getCareerPath() != null) {
            student.setCareerPath(request.getCareerPath());
        }
        if (request.getEmploymentStatus() != null) {
            student.setEmploymentStatus(request.getEmploymentStatus());
        }
        if (request.getCompanyName() != null) {
            student.setCompanyName(request.getCompanyName());
        }
        if (request.getSalaryRange() != null) {
            student.setSalaryRange(request.getSalaryRange());
        }

        Student updated = studentRepository.save(student);
        return ResponseEntity.ok(updated);
    }
}

