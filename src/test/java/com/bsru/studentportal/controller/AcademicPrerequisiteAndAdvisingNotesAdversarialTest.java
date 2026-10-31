package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.model.AdvisingNote;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.RegistrationPeriodRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AdvisorInsightService;
import com.bsru.studentportal.service.NotificationService;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.TimetableService;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.RegistrationCheck;
import com.bsru.studentportal.service.TimetableService.SessionView;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Adversarial Empirical Verification Suite for Milestone 6 (WP-6)
 * Specifically challenging:
 * 1. TimetableService Prerequisite Validation:
 *    - Passing grades (A, B+, B, C+, C, D+, D, P, S)
 *    - Non-passing grades (F, W, I, U, ยังไม่ออกผล)
 *    - Null, empty, whitespace grades
 *    - Course retakes (F -> A, W -> D, F -> F, etc.)
 *    - Multi-prerequisite combinations and complex delimiters
 *    - Unrestricted sections
 *    - Enforcement during checkRegistration, submitRegistration, and enroll
 * 2. AdvisorController Advising Notes:
 *    - Full CRUD for assigned advisor
 *    - RBAC enforcement (Student -> 403 Forbidden)
 *    - Advisee boundaries (Non-advisee -> 404 Not Found)
 *    - Cross-advisee note deletion isolation
 *    - Note validation (blank summary -> 400, invalid date -> 400)
 *    - Admin fallback access
 */
@ExtendWith(MockitoExtension.class)
public class AcademicPrerequisiteAndAdvisingNotesAdversarialTest {

    // =========================================================================
    // Nested Class: Prerequisite Validation Adversarial Tests
    // =========================================================================
    @Nested
    @DisplayName("Adversarial Challenges: TimetableService Prerequisite Validation")
    class PrerequisiteValidationChallenges {

        @Mock private ClassSectionRepository sectionRepository;
        @Mock private SectionEnrollmentRepository enrollmentRepository;
        @Mock private RegistrationPeriodRepository periodRepository;
        @Mock private StudentRepository studentRepository;
        @Mock private AdvisorRepository advisorRepository;
        @Mock private NotificationService notificationService;
        @Mock private CourseGradeRepository courseGradeRepository;

        private TimetableService timetableService;

        private final String studentId = "6421100042";
        private final Actor studentActor = new Actor(Actor.Kind.STUDENT, studentId);
        private Student student;
        private Advisor advisor;
        private ClassSection sectionWithPrereq;

        @BeforeEach
        void setUp() {
            timetableService = new TimetableService(
                    sectionRepository,
                    enrollmentRepository,
                    periodRepository,
                    studentRepository,
                    advisorRepository,
                    notificationService,
                    courseGradeRepository
            );

            advisor = new Advisor("ADV-01", "อ.วิชัย", "Wichai", "wichai@bsru.ac.th", "0812345678", "วิทยาการคอมพิวเตอร์");

            student = new Student();
            student.setStudentId(studentId);
            student.setNameTh("สมชาย ใจดี");
            student.setStudentSection("D1");
            student.setAdvisor(advisor);

            lenient().when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

            sectionWithPrereq = new ClassSection(
                    201L,
                    2566,
                    1,
                    "CS201",
                    "Data Structures",
                    3,
                    "D1",
                    0,
                    LocalTime.of(9, 0),
                    LocalTime.of(12, 0),
                    "Lab1",
                    advisor,
                    40,
                    ClassSection.ApprovalStatus.APPROVED,
                    null
            );
            sectionWithPrereq.setPrerequisiteCourseCodes("CS101");
        }

        @ParameterizedTest(name = "Passing grade ''{0}'' must allow prerequisite validation to succeed")
        @ValueSource(strings = {"A", "B+", "B", "C+", "C", "D+", "D", "P", "S", "a", "b+", "p", "s"})
        void testPassingGrades_allowRegistrationCheck(String gradeStr) {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade grade = new CourseGrade(1L, student, 2565, 1, "CS101", "Intro Programming", 3, gradeStr, 2.0);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(grade));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok(), "Expected registration check to be ok for passing grade: " + gradeStr);
            assertTrue(check.valid());
            assertTrue(check.getErrors().isEmpty());
        }

        @ParameterizedTest(name = "Non-passing grade ''{0}'' must block prerequisite validation")
        @ValueSource(strings = {"F", "W", "I", "U", "ยังไม่ออกผล", "f", "w", "i", "u"})
        void testNonPassingGrades_blockRegistrationCheck(String gradeStr) {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade grade = new CourseGrade(1L, student, 2565, 1, "CS101", "Intro Programming", 3, gradeStr, 0.0);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(grade));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok(), "Expected registration check to fail for non-passing grade: " + gradeStr);
            assertFalse(check.valid());
            assertFalse(check.getErrors().isEmpty());
            assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
        }

        @Test
        @DisplayName("Prerequisite check: Null, empty, or blank string grade blocks registration")
        void testNullOrBlankGrades_blockRegistration() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade nullGrade = new CourseGrade(1L, student, 2565, 1, "CS101", "Intro", 3, null, null);
            CourseGrade blankGrade = new CourseGrade(2L, student, 2565, 2, "CS101", "Intro", 3, "   ", null);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(nullGrade, blankGrade));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok());
            assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
        }

        @Test
        @DisplayName("Retake Scenario: First attempt F, second attempt C -> Allowed")
        void testRetakeScenario_failedThenPassed_allowed() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade fail1 = new CourseGrade(1L, student, 2564, 1, "CS101", "Intro", 3, "F", 0.0);
            CourseGrade pass2 = new CourseGrade(2L, student, 2564, 2, "CS101", "Intro", 3, "C", 2.0);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(pass2, fail1));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok());
            assertTrue(check.getErrors().isEmpty());
        }

        @Test
        @DisplayName("Retake Scenario: First attempt W, second attempt ยังไม่ออกผล, third attempt P -> Allowed")
        void testRetakeScenario_multipleAttemptsFinallyPassed_allowed() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade att1 = new CourseGrade(1L, student, 2564, 1, "CS101", "Intro", 3, "W", null);
            CourseGrade att2 = new CourseGrade(2L, student, 2564, 2, "CS101", "Intro", 3, "ยังไม่ออกผล", null);
            CourseGrade att3 = new CourseGrade(3L, student, 2565, 1, "CS101", "Intro", 3, "P", null);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(att3, att2, att1));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok());
        }

        @Test
        @DisplayName("Retake Scenario: First attempt F, second attempt W, third attempt U -> Still Blocked")
        void testRetakeScenario_multipleAttemptsAllFailed_blocked() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade att1 = new CourseGrade(1L, student, 2564, 1, "CS101", "Intro", 3, "F", 0.0);
            CourseGrade att2 = new CourseGrade(2L, student, 2564, 2, "CS101", "Intro", 3, "W", null);
            CourseGrade att3 = new CourseGrade(3L, student, 2565, 1, "CS101", "Intro", 3, "U", null);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(att3, att2, att1));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok());
            assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
        }

        @Test
        @DisplayName("Retake Scenario: Passed previously (B) and retook later for grade improvement with W -> Allowed")
        void testRetakeScenario_passedEarlierThenWithdrew_allowed() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade att1 = new CourseGrade(1L, student, 2564, 1, "CS101", "Intro", 3, "B", 3.0);
            CourseGrade att2 = new CourseGrade(2L, student, 2565, 1, "CS101", "Intro", 3, "W", null);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(att2, att1));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok());
        }

        @Test
        @DisplayName("Delimiters & Whitespace: Handles semicolon, comma, newline, tab in prerequisite string")
        void testComplexDelimitersInPrerequisites() {
            sectionWithPrereq.setPrerequisiteCourseCodes(" CS101 ; CS102, \t CS103 \n CS104 ");
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            CourseGrade g1 = new CourseGrade(1L, student, 2564, 1, "cs101", "P1", 3, "A", 4.0);
            CourseGrade g2 = new CourseGrade(2L, student, 2564, 2, "CS102", "P2", 3, "B+", 3.5);
            CourseGrade g3 = new CourseGrade(3L, student, 2565, 1, "CS103", "P3", 3, "C", 2.0);
            // CS104 missing
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(g1, g2, g3));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertFalse(check.ok());
            assertEquals("ไม่ผ่านวิชาบังคับก่อน: CS104", check.getErrors().get(0));
        }

        @ParameterizedTest(name = "Section with prerequisite codes ''{0}'' is unimpeded")
        @ValueSource(strings = {"", "   ", " \t \n "})
        void testBlankPrerequisites_unimpeded(String blankPrereq) {
            sectionWithPrereq.setPrerequisiteCourseCodes(blankPrereq);
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));

            RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
            RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

            assertTrue(check.ok());
            verify(courseGradeRepository, never()).findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(anyString());
        }

        @Test
        @DisplayName("Enroll Method: Blocked with HTTP 409 CONFLICT and TimetableException when prereq is missing")
        void testEnroll_unmetPrerequisite_throwsTimetableConflict() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of());

            RegistrationPeriod openPeriod = new RegistrationPeriod(1L, 2566, 1,
                    LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(5), false);
            when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

            EnrollmentRequest req = new EnrollmentRequest();
            req.setCourseCode("CS201");
            req.setAcademicYear(2566);
            req.setTerm(1);

            TimetableException ex = assertThrows(TimetableException.class, () ->
                    timetableService.enroll(studentActor, studentId, req)
            );

            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
            assertInstanceOf(IllegalArgumentException.class, (Throwable) ex);
        }

        @Test
        @DisplayName("Enroll Method: Allowed when student satisfied prerequisite")
        void testEnroll_metPrerequisite_succeeds() {
            when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                    .thenReturn(List.of(sectionWithPrereq));
            when(sectionRepository.findById(201L)).thenReturn(Optional.of(sectionWithPrereq));

            CourseGrade passGrade = new CourseGrade(1L, student, 2565, 1, "CS101", "Intro", 3, "A", 4.0);
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(List.of(passGrade));

            RegistrationPeriod openPeriod = new RegistrationPeriod(1L, 2566, 1,
                    LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(5), false);
            when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

            when(enrollmentRepository.save(any(SectionEnrollment.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            EnrollmentRequest req = new EnrollmentRequest();
            req.setCourseCode("CS201");
            req.setAcademicYear(2566);
            req.setTerm(1);

            SessionView view = timetableService.enroll(studentActor, studentId, req);
            assertNotNull(view);
            assertEquals("CS201", view.courseCode());
        }
    }

    // =========================================================================
    // Nested Class: Advisor Notes Adversarial Tests
    // =========================================================================
    @Nested
    @DisplayName("Adversarial Challenges: AdvisorController Advising Notes")
    class AdvisorNotesChallenges {

        @Mock private AdvisorInsightService insights;
        @Mock private AdvisorRepository advisorRepository;
        @Mock private StudentAdminService studentAdminService;
        @Mock private AdvisingNoteRepository advisingNoteRepository;
        @Mock private StudentRepository studentRepository;

        private AdvisorController advisorController;

        private final String adviseeId = "6421100042";
        private final String otherStudentId = "6421100099";
        private final String advisorId = "ADV-01";
        private final String otherAdvisorId = "ADV-02";

        private Authentication advisorAuth;
        private Authentication advisorAliasAuth;
        private Authentication otherAdvisorAuth;
        private Authentication studentAuth;
        private Authentication adminAuth;
        private Authentication anonAuth;

        private Student advisee;
        private Student otherAdvisee;
        private Advisor advisor;
        private Advisor otherAdvisor;

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
            otherAdvisor = new Advisor(otherAdvisorId, "อ.สุภา", "Supa", "supa@bsru.ac.th", "0812345679", "วิทยาการคอมพิวเตอร์");

            advisee = new Student();
            advisee.setStudentId(adviseeId);
            advisee.setNameTh("สมชาย ใจดี");
            advisee.setAdvisor(advisor);

            otherAdvisee = new Student();
            otherAdvisee.setStudentId(otherStudentId);
            otherAdvisee.setNameTh("สมหญิง รักดี");
            otherAdvisee.setAdvisor(otherAdvisor);

            advisorAuth = new UsernamePasswordAuthenticationToken(advisorId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
            advisorAliasAuth = new UsernamePasswordAuthenticationToken("advisor", "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
            otherAdvisorAuth = new UsernamePasswordAuthenticationToken(otherAdvisorId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
            studentAuth = new UsernamePasswordAuthenticationToken(adviseeId, "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
            adminAuth = new UsernamePasswordAuthenticationToken("admin", "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
            anonAuth = new AnonymousAuthenticationToken("key", "anonymousUser",
                    List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        }

        @Test
        @DisplayName("Advisor CRUD: Advisor alias 'advisor' maps to ADV-01 and creates note successfully")
        void testAdvisorAlias_createsNoteSuccessfully() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            AdvisingNote mockSaved = new AdvisingNote(101L, adviseeId, advisorId,
                    "ปรึกษาเรื่องแผนการเรียน", LocalDate.of(2026, 11, 20), "NORMAL", LocalDateTime.now());
            when(advisingNoteRepository.save(any(AdvisingNote.class))).thenReturn(mockSaved);

            Map<String, Object> body = Map.of(
                    "summary", "ปรึกษาเรื่องแผนการเรียน",
                    "followUpDate", "2026-11-20T10:00:00",
                    "riskLevelSnapshot", "NORMAL"
            );

            ResponseEntity<?> resp = advisorController.createNote(adviseeId, body, advisorAliasAuth);

            assertEquals(HttpStatus.CREATED, resp.getStatusCode());
            AdvisingNote saved = (AdvisingNote) resp.getBody();
            assertNotNull(saved);
            assertEquals(101L, saved.getId());
            assertEquals(advisorId, saved.getAdvisorId());
            assertEquals("ปรึกษาเรื่องแผนการเรียน", saved.getSummary());
        }

        @Test
        @DisplayName("Security RBAC: Student caller is rejected with HTTP 403 Forbidden across all endpoints")
        void testStudentCaller_forbiddenOnAllEndpoints() {
            // GET list
            ResponseEntity<?> listResp = advisorController.listNotes(adviseeId, studentAuth);
            assertEquals(HttpStatus.FORBIDDEN, listResp.getStatusCode());

            // POST create
            ResponseEntity<?> createResp = advisorController.createNote(adviseeId, Map.of("summary", "hack"), studentAuth);
            assertEquals(HttpStatus.FORBIDDEN, createResp.getStatusCode());

            // DELETE
            ResponseEntity<?> deleteResp = advisorController.deleteNote(adviseeId, 1L, studentAuth);
            assertEquals(HttpStatus.FORBIDDEN, deleteResp.getStatusCode());

            verifyNoInteractions(advisingNoteRepository);
        }

        @Test
        @DisplayName("Security RBAC: Anonymous or unauthenticated caller receives HTTP 403 Forbidden")
        void testAnonymousCaller_forbidden() {
            ResponseEntity<?> listResp = advisorController.listNotes(adviseeId, anonAuth);
            assertEquals(HttpStatus.FORBIDDEN, listResp.getStatusCode());

            ResponseEntity<?> nullAuthResp = advisorController.listNotes(adviseeId, null);
            assertEquals(HttpStatus.FORBIDDEN, nullAuthResp.getStatusCode());
        }

        @Test
        @DisplayName("Advisee Boundary: Advisor calling for another advisor's student receives HTTP 404 Not Found")
        void testAdvisor_nonAdvisee_returns404NotFound() {
            when(studentRepository.findById(otherStudentId)).thenReturn(Optional.of(otherAdvisee));
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            // List notes for other advisee
            ResponseEntity<?> listResp = advisorController.listNotes(otherStudentId, advisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, listResp.getStatusCode());

            // Symmetric check: otherAdvisor calling for adviseeId also receives 404
            ResponseEntity<?> symmetricResp = advisorController.listNotes(adviseeId, otherAdvisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, symmetricResp.getStatusCode());

            // Create note for other advisee
            ResponseEntity<?> createResp = advisorController.createNote(otherStudentId, Map.of("summary", "note"), advisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, createResp.getStatusCode());

            // Delete note for other advisee
            ResponseEntity<?> deleteResp = advisorController.deleteNote(otherStudentId, 5L, advisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, deleteResp.getStatusCode());

            verify(advisingNoteRepository, never()).save(any());
            verify(advisingNoteRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Advisee Boundary: Calling for nonexistent student ID returns HTTP 404 Not Found")
        void testNonexistentStudent_returns404NotFound() {
            when(studentRepository.findById("9999999999")).thenReturn(Optional.empty());

            ResponseEntity<?> resp = advisorController.listNotes("9999999999", advisorAuth);
            assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
        }

        @Test
        @DisplayName("Cross-Student Deletion Isolation: Cannot delete note belonging to another student")
        void testCrossStudentDeletion_isolatedAndRejected() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            // Note exists, but belongs to otherStudentId, not adviseeId
            AdvisingNote noteOfOtherStudent = new AdvisingNote(99L, otherStudentId, otherAdvisorId,
                    "Note of other", null, null, LocalDateTime.now());
            when(advisingNoteRepository.findById(99L)).thenReturn(Optional.of(noteOfOtherStudent));

            ResponseEntity<?> resp = advisorController.deleteNote(adviseeId, 99L, advisorAuth);

            assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
            verify(advisingNoteRepository, never()).delete(any());
        }

        @ParameterizedTest(name = "Blank summary ''{0}'' returns HTTP 400 Bad Request")
        @ValueSource(strings = {"", "   ", " \t \n "})
        void testBlankSummary_returns400BadRequest(String blankSummary) {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            Map<String, Object> body = Map.of("summary", blankSummary);
            ResponseEntity<?> resp = advisorController.createNote(adviseeId, body, advisorAuth);

            assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
            verify(advisingNoteRepository, never()).save(any());
        }

        @Test
        @DisplayName("Validation: Null body or missing summary key returns HTTP 400 Bad Request")
        void testMissingSummaryKey_returns400BadRequest() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            ResponseEntity<?> resp1 = advisorController.createNote(adviseeId, Map.of(), advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, resp1.getStatusCode());

            ResponseEntity<?> resp2 = advisorController.createNote(adviseeId, null, advisorAuth);
            assertEquals(HttpStatus.BAD_REQUEST, resp2.getStatusCode());
        }

        @Test
        @DisplayName("Validation: Invalid follow up date format returns HTTP 400 Bad Request")
        void testInvalidDateFormat_returns400BadRequest() {
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));

            Map<String, Object> body = Map.of(
                    "summary", "บันทึกข้อมูล",
                    "followUpDate", "31/12/2026"
            );
            ResponseEntity<?> resp = advisorController.createNote(adviseeId, body, advisorAuth);

            assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
            verify(advisingNoteRepository, never()).save(any());
        }

        @Test
        @DisplayName("Admin Access: Admin can view, create, and delete notes for any student")
        void testAdminRole_canManageNotesForAnyStudent() {
            // Admin lists notes
            when(studentRepository.existsById(adviseeId)).thenReturn(true);
            AdvisingNote note = new AdvisingNote(50L, adviseeId, advisorId, "Existing", null, null, LocalDateTime.now());
            when(advisingNoteRepository.findByStudentIdOrderByCreatedAtDesc(adviseeId)).thenReturn(List.of(note));

            ResponseEntity<?> listResp = advisorController.listNotes(adviseeId, adminAuth);
            assertEquals(HttpStatus.OK, listResp.getStatusCode());

            // Admin creates note
            when(studentRepository.findById(adviseeId)).thenReturn(Optional.of(advisee));
            AdvisingNote adminSaved = new AdvisingNote(51L, adviseeId, advisorId, "Admin consultation", null, null, LocalDateTime.now());
            when(advisingNoteRepository.save(any(AdvisingNote.class))).thenReturn(adminSaved);

            ResponseEntity<?> createResp = advisorController.createNote(adviseeId, Map.of("summary", "Admin consultation"), adminAuth);
            assertEquals(HttpStatus.CREATED, createResp.getStatusCode());

            // Admin deletes note
            when(advisingNoteRepository.findById(50L)).thenReturn(Optional.of(note));
            ResponseEntity<?> deleteResp = advisorController.deleteNote(adviseeId, 50L, adminAuth);
            assertEquals(HttpStatus.OK, deleteResp.getStatusCode());
            verify(advisingNoteRepository, times(1)).delete(note);
        }
    }
}
