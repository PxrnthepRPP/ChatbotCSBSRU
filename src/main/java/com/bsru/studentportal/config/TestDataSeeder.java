package com.bsru.studentportal.config;

import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.GraduationAuditService;
import com.bsru.studentportal.service.StudentAdminService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

/**
 * Test data that travels with the code (resources/testdata/test-data.json + graduation/<id>.json), so a
 * fresh clone has the same students to try the advisor AI on: real students with grades (audit sheet),
 * activities and a timetable, plus the sections they are enrolled in. Only adds what is missing, so data
 * edited on a machine is kept. Turn off with APP_SEED_TEST_DATA=false.
 * Runs before CohortAdvisorService.syncAll (order 0), after DataSeeder.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TestDataSeeder {

    @Value("${app.seed-test-data:true}")
    private boolean enabled;

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final ClassSectionRepository sectionRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final GraduationProgressRepository progressRepository;
    private final GraduationAuditRepository auditRepository;
    private final GraduationAuditService graduationAuditService;
    private final StudentAdminService studentAdminService;

    @EventListener(ApplicationReadyEvent.class)
    @Order(0)
    @Transactional
    public void seed() {
        if (!enabled) return;
        ClassPathResource resource = new ClassPathResource("testdata/test-data.json");
        if (!resource.exists()) return;
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = new ObjectMapper().readTree(in);
            int sections = 0, students = 0, enrollments = 0;
            for (JsonNode s : root.path("sections")) if (seedSection(s)) sections++;
            for (JsonNode s : root.path("students")) {
                if (seedStudent(s)) students++;
                enrollments += seedStudentData(s);
            }
            if (sections + students + enrollments > 0) {
                log.info("Test data: added {} sections, {} students, {} enrollments", sections, students, enrollments);
            }
        } catch (Exception e) {
            log.warn("Could not load test data: {}", e.getMessage());
        }
    }

    private boolean seedSection(JsonNode j) {
        int year = j.path("academicYear").asInt();
        int term = j.path("term").asInt();
        String code = j.path("courseCode").asText();
        String sectionNo = j.path("sectionNo").asText();
        if (findSection(year, term, code, sectionNo).isPresent()) return false;
        ClassSection sec = new ClassSection();
        sec.setAcademicYear(year);
        sec.setTerm(term);
        sec.setCourseCode(code);
        sec.setCourseName(j.path("courseName").asText());
        sec.setCredits(j.path("credits").asInt());
        sec.setSectionNo(sectionNo);
        sec.setDayOfWeek(j.path("dayOfWeek").asInt());
        sec.setStartTime(LocalTime.parse(j.path("startTime").asText()));
        sec.setEndTime(LocalTime.parse(j.path("endTime").asText()));
        sec.setRoom(j.hasNonNull("room") ? j.path("room").asText() : null);
        sec.setInstructor(j.hasNonNull("instructorId") ? advisorRepository.findById(j.path("instructorId").asText()).orElse(null) : null);
        sec.setCapacity(j.hasNonNull("capacity") ? j.path("capacity").asInt() : null);
        sectionRepository.save(sec);
        return true;
    }

    /** Creates the student (with a login: first password = student id) when missing */
    private boolean seedStudent(JsonNode j) {
        String id = j.path("studentId").asText();
        if (studentRepository.existsById(id)) return false;
        StudentRequest req = new StudentRequest();
        req.setStudentId(id);
        req.setNameTh(j.path("nameTh").asText());
        req.setNameEn(j.path("nameEn").asText());
        req.setYear(j.path("year").asInt());
        req.setStatus(j.path("status").asText());
        req.setStudentSection(j.path("studentSection").asText("D1"));
        req.setSimulated(false);
        studentAdminService.create(req);
        return true;
    }

    /** Audit sheet, activities and enrollments, each only when the student has none yet */
    private int seedStudentData(JsonNode j) throws Exception {
        String id = j.path("studentId").asText();
        Optional<Student> student = studentRepository.findById(id);
        if (student.isEmpty()) return 0;

        ClassPathResource sheet = new ClassPathResource("graduation/" + id + ".json");
        if (!auditRepository.existsById(id) && sheet.exists()) {
            try (InputStream in = sheet.getInputStream()) {
                graduationAuditService.save(id, new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }

        JsonNode activity = j.path("activity");
        if (!activity.isMissingNode() && !progressRepository.existsById(id)) {
            GraduationProgress g = new GraduationProgress();
            g.setStudentId(id);
            g.setCoreRequired(0);
            g.setCoreEarned(0);
            g.setGeRequired(0);
            g.setGeEarned(0);
            g.setElectiveRequired(0);
            g.setElectiveEarned(0);
            g.setFreeRequired(0);
            g.setFreeEarned(0);
            g.setGpaRequired(2.0);
            g.setActivityCompleted(activity.path("completed").asInt());
            g.setActivityRequired(activity.path("required").asInt());
            g.setStatus("กำลังดำเนินการ");
            progressRepository.save(g);
        }

        int added = 0;
        if (enrollmentRepository.findByStudentStudentId(id).isEmpty()) {
            for (JsonNode e : j.path("enrollments")) {
                Optional<ClassSection> sec = findSection(e.path("academicYear").asInt(), e.path("term").asInt(),
                        e.path("courseCode").asText(), e.path("sectionNo").asText());
                if (sec.isEmpty()) continue;
                enrollmentRepository.save(new SectionEnrollment(null, student.get(), sec.get(), LocalDateTime.now(),
                        SectionEnrollment.EnrollmentStatus.CONFIRMED, null));
                added++;
            }
        }
        return added;
    }

    private Optional<ClassSection> findSection(int year, int term, String code, String sectionNo) {
        return sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(year, term, code)
                .stream().filter(s -> s.getSectionNo().equalsIgnoreCase(sectionNo)).findFirst();
    }
}
