package com.bsru.studentportal.service;

import com.bsru.studentportal.controller.AdvisorController;
import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.model.AdvisingNote;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.RegistrationPeriodRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.RegistrationCheck;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AcademicMilestone6AdversarialStressTest {

    // =========================================================================
    // Nested: Timetable Prerequisite Stress & Boundary Testing
    // =========================================================================
    @Nested
    @DisplayName("Stress Test: TimetableService Academic Prerequisite Validation")
    class TimetablePrerequisiteStress {

        @Mock private ClassSectionRepository sectionRepository;
        @Mock private SectionEnrollmentRepository enrollmentRepository;
        @Mock private RegistrationPeriodRepository periodRepository;
        @Mock private StudentRepository studentRepository;
        @Mock private AdvisorRepository advisorRepository;
        @Mock private CourseGradeRepository courseGradeRepository;

        private TimetableService timetableService;

        private final String studentId = "6621100042";
        private final Actor studentActor = new Actor(Actor.Kind.STUDENT, studentId);
        private Student student;
        private Advisor advisor;

        @BeforeEach
        void setUp() {
            timetableService = new TimetableService(
                    sectionRepository,
                    enrollmentRepository,
                    periodRepository,
                    studentRepository,
                    advisorRepository,
                    courseGradeRepository
            );

            advisor = new Advisor("ADV-01", "อ.วิชัย", "Wichai", "wichai@bsru.ac.th", "0812345678", "วิทยาการคอมพิวเตอร์");

            student = new Student();
            student.setStudentId(studentId);
            student.setNameTh("สมชาย ใจดี");
            student.setStudentSection("D1");
            student.setAdvisor(advisor);

            lenient().when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        }

        private ClassSection createSection(Long id, String courseCode, String prereqs) {
            ClassSection s = new ClassSection(
                    id, 2566, 1, courseCode, "Course " + courseCode, 3, "D1", 0,
                    LocalTime.of(9, 0), LocalTime.of(12, 0), "Lab1", advisor, 40,
                    ClassSection.ApprovalStatus.APPROVED, null
            );
            s.setPrerequisiteCourseCodes(prereqs);
            return s;
        }

        @Test
        @DisplayName("Circular Dependency: Section A requires B and Section B requires A; both fail cart check")
        void testCircularPrerequisites_bothReportMissingPrereq() {
            ClassSection secA = createSection(101L, "CS201", "CS202");
            ClassSection secB = createSection(102L, "CS202", "CS201");
            secB.setStartTime(LocalTime.of(13, 0));
            secB.setEndTime(LocalTime.of(16, 0));

            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(secA));
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS202"))
                    .thenReturn(List.of(secB));
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of()); // Student has neither

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201", "CS202"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok(), "Circular prereqs without completed grades must fail check");
            assertEquals(2, check.items().size());
            assertTrue(check.items().get(0).problems().contains("ไม่ผ่านวิชาบังคับก่อน: CS202"));
            assertTrue(check.items().get(1).problems().contains("ไม่ผ่านวิชาบังคับก่อน: CS201"));

            // Submit registration must throw CONFLICT
            RegistrationPeriod openPeriod = new RegistrationPeriod(1L, 2566, 1,
                    LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(5), false);
            when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

            TimetableException ex = assertThrows(TimetableException.class, () ->
                    timetableService.submitRegistration(studentActor, studentId, req));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("ไม่ผ่านวิชาบังคับก่อน"));
        }

        @Test
        @DisplayName("Prerequisite in active cart/enrollment is NOT counted as passed grade (requires CourseGrade)")
        void testPrerequisiteEnrolledInCurrentCartOrPending_isNotSufficient() {
            // Student tries to register CS101 and CS201 together, where CS201 requires CS101
            ClassSection sec1 = createSection(101L, "CS101", null);
            ClassSection sec2 = createSection(102L, "CS201", "CS101");
            sec2.setStartTime(LocalTime.of(13, 0));
            sec2.setEndTime(LocalTime.of(16, 0));

            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS101"))
                    .thenReturn(List.of(sec1));
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sec2));
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of()); // CS101 is not graded yet

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS101", "CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok());
            // CS101 should have no problems
            assertTrue(check.items().get(0).problems().isEmpty());
            // CS201 must fail because CS101 has not been passed in grade history
            assertTrue(check.items().get(1).problems().contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
        }

        @Test
        @DisplayName("Malformed Delimiters: Handles multi-delimiter edge cases without throwing exception")
        void testMalformedDelimiters_handledCleanly() {
            ClassSection sec = createSection(101L, "CS301", ",,,   ;;;  \t \n  CS101  ,,, \n CS102 ;;;   ");
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS301"))
                    .thenReturn(List.of(sec));

            // Student only passed CS101, missing CS102
            CourseGrade g1 = new CourseGrade(1L, student, 2565, 1, "CS101", "Intro", 3, "A", 4.0);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(g1));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS301"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok());
            assertEquals("ไม่ผ่านวิชาบังคับก่อน: CS102", check.items().get(0).problems().get(0));
        }

        @Test
        @DisplayName("Pristine Dry Run: checkRegistration does not mutate database")
        void testCheckRegistration_neverMutatesEnrollmentDb() {
            ClassSection sec = createSection(101L, "CS201", "CS101");
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sec));
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(new CourseGrade(1L, student, 2565, 1, "CS101", "Intro", 3, "A", 4.0)));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok());
            verify(enrollmentRepository, never()).save(any());
            verify(enrollmentRepository, never()).delete(any());
            verify(enrollmentRepository, never()).flush();
        }

        @Test
        @DisplayName("Enroll Method Delegation: Single course enrollment strictly validates prerequisites")
        void testEnroll_delegatesAndEnforcesPrerequisites() {
            ClassSection sec = createSection(201L, "CS201", "CS101");
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sec));
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of()); // No grade

            RegistrationPeriod openPeriod = new RegistrationPeriod(1L, 2566, 1,
                    LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(5), false);
            when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

            EnrollmentRequest req = new EnrollmentRequest();
            req.setCourseCode("CS201");
            req.setAcademicYear(2566);
            req.setTerm(1);

            TimetableException ex = assertThrows(TimetableException.class, () ->
                    timetableService.enroll(studentActor, studentId, req));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
            verify(enrollmentRepository, never()).save(any());
        }
    }

    // =========================================================================
    // Nested: Advisor Notes RBAC & Adversarial Boundary Testing
    // =========================================================================
    @Nested
    @DisplayName("Stress Test: AdvisorController Advising Notes RBAC & Boundary")
    class AdvisorNotesRbacStress {

        @Mock private AdvisorInsightService insights;
        @Mock private AdvisorRepository advisorRepository;
        @Mock private StudentAdminService studentAdminService;
        @Mock private AdvisingNoteRepository advisingNoteRepository;
        @Mock private StudentRepository studentRepository;

        private AdvisorController advisorController;

        private final String adviseeId = "6621100042";
        private final String otherStudentId = "6621100099";
        private final String advisorId = "ADV-01";
        private final String otherAdvisorId = "ADV-02";

        private Authentication advisorAuth;
        private Authentication otherAdvisorAuth;
        private Authentication studentAuth;

        private Student advisee;
        private Advisor advisor;

        @BeforeEach
        void setUp() {
            advisorController = new AdvisorController(
                    insights,
                    advisorRepository,
                    studentAdminService,
                    advisingNoteRepository,
                    studentRepository
            );

            advisor = new Advisor(advisorId, "อ.วิชัย", "Wichai", "wichai@bsru.ac.th", "0812345678", "วิทยาการคอมพิวเตอร์");

            advisee = new Student();
            advisee.setStudentId(adviseeId);
            advisee.setNameTh("สมชาย ใจดี");
            advisee.setAdvisor(advisor);

            advisorAuth = new UsernamePasswordAuthenticationToken(advisorId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
            otherAdvisorAuth = new UsernamePasswordAuthenticationToken(otherAdvisorId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
            studentAuth = new UsernamePasswordAuthenticationToken(adviseeId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
        }

        @Test
        @DisplayName("IDOR / Cross-Student Attack: Deleting noteId that belongs to a different student is rejected with 404")
        void testCrossStudentNoteDelete_isPrevented() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            // Note 888 belongs to otherStudentId
            AdvisingNote foreignNote = new AdvisingNote(888L, otherStudentId, otherAdvisorId, "Foreign note", null, null, LocalDateTime.now());
            when(advisingNoteRepository.findById(888L)).thenReturn(Optional.of(foreignNote));

            // Caller requests delete under adviseeId's URI: DELETE /advisees/6621100042/notes/888
            ResponseEntity<?> resp = advisorController.deleteNote(adviseeId, 888L, advisorAuth);

            assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
            verify(advisingNoteRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Advising Note Creation: Rejects all variations of empty notes")
        void testEmptyNoteVariations_allRejectedWith400() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            // 1. null body
            ResponseEntity<?> r1 = advisorController.createNote(adviseeId, null, advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, r1.getStatusCode());

            // 2. empty map
            ResponseEntity<?> r2 = advisorController.createNote(adviseeId, Map.of(), advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, r2.getStatusCode());

            // 3. summary is empty string
            ResponseEntity<?> r3 = advisorController.createNote(adviseeId, Map.of("summary", ""), advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, r3.getStatusCode());

            // 4. summary is whitespace only
            ResponseEntity<?> r4 = advisorController.createNote(adviseeId, Map.of("summary", "   \t \n  "), advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, r4.getStatusCode());

            verify(advisingNoteRepository, never()).save(any());
        }

        @Test
        @DisplayName("Delete Permissions: Student cannot delete, non-advisee advisor cannot delete, only owner advisor or admin can")
        void testDeletePermissions_strictlyEnforced() {
            // Student caller -> 403 Forbidden
            ResponseEntity<?> rStudent = advisorController.deleteNote(adviseeId, 10L, studentAuth);
            assertEquals(HttpStatus.FORBIDDEN, rStudent.getStatusCode());

            // Other advisor -> 404 Not Found
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));
            ResponseEntity<?> rOtherAdvisor = advisorController.deleteNote(adviseeId, 10L, otherAdvisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, rOtherAdvisor.getStatusCode());

            // Owner advisor -> 200 OK
            AdvisingNote note = new AdvisingNote(10L, adviseeId, advisorId, "Notes", null, null, LocalDateTime.now());
            when(advisingNoteRepository.findById(10L)).thenReturn(Optional.of(note));
            ResponseEntity<?> rOwner = advisorController.deleteNote(adviseeId, 10L, advisorAuth);
            assertEquals(HttpStatus.OK, rOwner.getStatusCode());
            verify(advisingNoteRepository, times(1)).delete(note);
        }
    }
}
