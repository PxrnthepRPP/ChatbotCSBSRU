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
import com.bsru.studentportal.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
public class ApiController {

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final AcademicRecordService academicRecordService;
    private final GraduationAuditService graduationAuditService;
    private final NotificationService notificationService;

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
            return ResponseEntity.ok(studentRepository.findByAdvisorId(advisorId.get()));
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
    public ResponseEntity<?> getAllPetitions(Authentication authentication) {
        if (CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.ok(petitionRepository.findAll(Sort.by(Sort.Direction.DESC, "submittedAt")));
        }
        Optional<String> advisorId = CurrentUser.advisorId(authentication);
        if (advisorId.isPresent()) {
            return ResponseEntity.ok(petitionRepository.findByStudentAdvisorIdOrderBySubmittedAtDesc(advisorId.get()));
        }
        Optional<String> studentId = CurrentUser.studentId(authentication);
        if (studentId.isPresent()) {
            return ResponseEntity.ok(petitionRepository.findByStudentStudentIdOrderBySubmittedAtDesc(studentId.get()));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "ไม่อนุญาตให้เข้าถึงข้อมูลคำร้อง"));
    }

    @PostMapping("/petitions")
    public ResponseEntity<?> submitPetition(
            @RequestBody PetitionRequest request,
            Authentication authentication) {

        if (request == null || request.getTitle() == null || request.getTitle().isBlank()
                || request.getType() == null || request.getType().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title and type are required"));
        }

        String effectiveStudentId;
        Optional<String> authStudentId = CurrentUser.studentId(authentication);
        if (authStudentId.isPresent()) {
            String callerStudentId = authStudentId.get();
            if (request.getStudentId() != null && !request.getStudentId().isBlank()
                    && !request.getStudentId().equals(callerStudentId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "ไม่อนุญาตให้ยื่นคำร้องแทนนักศึกษาคนอื่น"));
            }
            effectiveStudentId = callerStudentId;
        } else if (CurrentUser.isAdmin(authentication)) {
            effectiveStudentId = request.getStudentId();
            if (effectiveStudentId == null || effectiveStudentId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "studentId is required"));
            }
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "เฉพาะนักศึกษาหรือผู้ดูแลระบบเท่านั้นที่สามารถยื่นคำร้องได้"));
        }

        Student student = studentRepository.findById(effectiveStudentId).orElse(null);
        if (student == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Student not found with ID: " + effectiveStudentId));
        }

        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);
        List<String> existingIds = petitionRepository.findPetitionIdsStartingWith(prefix + "%");
        int maxSeq = 0;
        for (String pid : existingIds) {
            if (pid != null && pid.startsWith(prefix)) {
                try {
                    int seq = Integer.parseInt(pid.substring(prefix.length()));
                    if (seq > maxSeq) {
                        maxSeq = seq;
                    }
                } catch (NumberFormatException ignored) {}
            }
        }
        int nextSeq = maxSeq + 1;
        String petitionId = String.format("PET-%d-%03d", yearBE, nextSeq);
        while (petitionRepository.existsById(petitionId)) {
            nextSeq++;
            petitionId = String.format("PET-%d-%03d", yearBE, nextSeq);
        }

        AcademicPetition petition = new AcademicPetition();
        petition.setId(petitionId);
        petition.setType(request.getType());
        petition.setTitle(request.getTitle());
        petition.setDetails(request.getDetails());
        petition.setAttachment(request.getAttachment());
        petition.setSubmittedAt(LocalDateTime.now());
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
        petition.setAdminComment(null);
        petition.setStudent(student);

        AcademicPetition saved = petitionRepository.save(petition);
        if (student.getAdvisor() != null && student.getAdvisor().getId() != null) {
            notificationService.notifyUser(
                    student.getAdvisor().getId(),
                    "มีคำร้องใหม่รอการพิจารณา",
                    "นักศึกษา " + (student.getNameTh() != null ? student.getNameTh() : student.getStudentId())
                            + " (" + student.getStudentId() + ") ยื่นคำร้อง: " + saved.getTitle(),
                    "advisor-petitions",
                    "PETITION"
            );
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/petitions/{id}/status")
    public ResponseEntity<?> updatePetitionStatus(
            @PathVariable String id,
            @RequestBody PetitionStatusUpdateRequest request,
            Authentication authentication) {

        if (CurrentUser.studentId(authentication).isPresent() && !CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "นักศึกษาไม่ได้รับอนุญาตให้แก้ไขสถานะคำร้อง"));
        }

        boolean isAdmin = CurrentUser.isAdmin(authentication);
        Optional<String> advisorId = CurrentUser.advisorId(authentication);
        if (!isAdmin && advisorId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "เฉพาะอาจารย์ที่ปรึกษาหรือผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขสถานะคำร้องได้"));
        }

        AcademicPetition petition = id != null ? petitionRepository.findById(id).orElse(null) : null;
        if (petition == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Petition not found with ID: " + id));
        }

        if (!isAdmin) {
            if (petition.getStudent() == null || petition.getStudent().getAdvisor() == null
                    || !advisorId.get().equals(petition.getStudent().getAdvisor().getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "อาจารย์สามารถแก้ไขสถานะได้เฉพาะคำร้องของนักศึกษาในความดูแลเท่านั้น"));
            }
        }

        if (request == null || request.getStatus() == null || request.getStatus().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "status is required"));
        }

        String targetStatus = request.getStatus().trim();

        if (!isAdmin) {
            // Advisor caller
            if ("อนุมัติ".equals(targetStatus)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "อาจารย์ที่ปรึกษาไม่สามารถอนุมัติคำร้องโดยตรงได้ ต้องส่งต่อให้ผู้ดูแลระบบพิจารณา"));
            }
            if (!"รอผู้ดูแลระบบอนุมัติ".equals(targetStatus) && !"ไม่อนุมัติ".equals(targetStatus) && !"ปฏิเสธ".equals(targetStatus)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "สถานะที่ระบุไม่ถูกต้องสำหรับการพิจารณาของอาจารย์ที่ปรึกษา"));
            }

            petition.setStatus(targetStatus);
            String advComment = request.getAdvisorComment();
            if (advComment == null || advComment.isBlank()) {
                advComment = request.getComment();
            }
            if (advComment == null || advComment.isBlank()) {
                advComment = request.getAdminComment(); // fallback for legacy tests
            }
            petition.setAdvisorComment(advComment);
            petition.setAdvisorReviewedAt(LocalDateTime.now());
            if (request.getAdminComment() != null) {
                petition.setAdminComment(request.getAdminComment());
            }
        } else {
            // Admin caller
            if (!"อนุมัติ".equals(targetStatus) && !"ไม่อนุมัติ".equals(targetStatus) && !"ปฏิเสธ".equals(targetStatus) && !"รอผู้ดูแลระบบอนุมัติ".equals(targetStatus)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "สถานะที่ระบุไม่ถูกต้องสำหรับการพิจารณาของผู้ดูแลระบบ"));
            }

            petition.setStatus(targetStatus);
            String admComment = request.getAdminComment();
            if (admComment == null || admComment.isBlank()) {
                admComment = request.getComment();
            }
            petition.setAdminComment(admComment);
            petition.setAdminReviewedAt(LocalDateTime.now());
        }

        AcademicPetition updated = petitionRepository.save(petition);

        Student student = updated.getStudent();
        String studentId = student != null ? student.getStudentId() : null;

        if (!isAdmin) {
            if ("รอผู้ดูแลระบบอนุมัติ".equals(targetStatus)) {
                notificationService.notifyUser(
                        "admin",
                        "คำร้องรอการอนุมัติขั้นสุดท้าย",
                        "คำร้อง " + updated.getId() + " (" + updated.getTitle() + ") ได้รับความเห็นชอบจากอาจารย์ที่ปรึกษาแล้ว",
                        "manage-petitions",
                        "PETITION"
                );
                if (studentId != null) {
                    notificationService.notifyUser(
                            studentId,
                            "คำร้องผ่านการพิจารณาจากอาจารย์ที่ปรึกษาแล้ว",
                            "คำร้องของคุณ (" + updated.getTitle() + ") ได้รับการเห็นชอบจากอาจารย์ที่ปรึกษา และส่งต่อให้ผู้ดูแลระบบแล้ว",
                            "petitions",
                            "PETITION"
                    );
                }
            } else if ("ไม่อนุมัติ".equals(targetStatus) || "ปฏิเสธ".equals(targetStatus)) {
                if (studentId != null) {
                    String comment = updated.getAdvisorComment() != null && !updated.getAdvisorComment().isBlank()
                            ? " เนื่องจาก: " + updated.getAdvisorComment() : "";
                    notificationService.notifyUser(
                            studentId,
                            "คำร้องไม่ผ่านความเห็นชอบจากอาจารย์ที่ปรึกษา",
                            "คำร้องของคุณ (" + updated.getTitle() + ") ไม่ได้รับความเห็นชอบจากอาจารย์ที่ปรึกษา" + comment,
                            "petitions",
                            "PETITION"
                    );
                }
            }
        } else {
            if ("อนุมัติ".equals(targetStatus)) {
                if (studentId != null) {
                    notificationService.notifyUser(
                            studentId,
                            "คำร้องได้รับการอนุมัติแล้ว",
                            "คำร้องของคุณ (" + updated.getTitle() + ") ได้รับการอนุมัติจากผู้ดูแลระบบเรียบร้อยแล้ว",
                            "petitions",
                            "PETITION"
                    );
                }
            } else if ("ไม่อนุมัติ".equals(targetStatus) || "ปฏิเสธ".equals(targetStatus)) {
                if (studentId != null) {
                    String comment = updated.getAdminComment() != null && !updated.getAdminComment().isBlank()
                            ? " เนื่องจาก: " + updated.getAdminComment() : "";
                    notificationService.notifyUser(
                            studentId,
                            "คำร้องไม่ได้รับการอนุมัติ",
                            "คำร้องของคุณ (" + updated.getTitle() + ") ไม่ได้รับการอนุมัติจากผู้ดูแลระบบ" + comment,
                            "petitions",
                            "PETITION"
                    );
                }
            }
        }

        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/students/{studentId}/career")
    public ResponseEntity<?> updateStudentCareer(
            @PathVariable String studentId,
            @RequestBody CareerUpdateRequest request,
            Authentication authentication) {

        boolean isAuthorized = CurrentUser.isAdmin(authentication) ||
                CurrentUser.studentId(authentication).map(studentId::equals).orElse(false);
        if (!isAuthorized) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "นักศึกษาสามารถแก้ไขข้อมูลสายอาชีพของตนเองเท่านั้น"));
        }

        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Student not found with ID: " + studentId));
        }

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Student not found with ID: " + studentId));
        }

        if (request != null) {
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
        }
        student.setCareerUpdatedAt(LocalDateTime.now());

        Student updated = studentRepository.save(student);
        return ResponseEntity.ok(updated);
    }
}

