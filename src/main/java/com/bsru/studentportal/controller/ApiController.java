package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.CareerUpdateRequest;
import com.bsru.studentportal.dto.PetitionRequest;
import com.bsru.studentportal.dto.PetitionStatusUpdateRequest;
import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ApiController {

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AcademicPetitionRepository petitionRepository;

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

    @GetMapping("/students")
    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }

    @GetMapping("/students/{studentId}")
    public ResponseEntity<Student> getStudentById(@PathVariable String studentId) {
        return studentRepository.findById(Objects.requireNonNull(studentId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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

