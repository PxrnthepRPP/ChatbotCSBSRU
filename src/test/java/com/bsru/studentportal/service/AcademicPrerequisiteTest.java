package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.Student;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AcademicPrerequisiteTest {

    @Mock
    private ClassSectionRepository sectionRepository;
    @Mock
    private SectionEnrollmentRepository enrollmentRepository;
    @Mock
    private RegistrationPeriodRepository periodRepository;
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private AdvisorRepository advisorRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private CourseGradeRepository courseGradeRepository;

    private TimetableService timetableService;

    private final String studentId = "6421100042";
    private final Actor studentActor = new Actor(Actor.Kind.STUDENT, studentId);
    private Student student;
    private ClassSection cs201Section;
    private Advisor advisor;

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

        cs201Section = new ClassSection(
                101L,
                2566,
                1,
                "CS201",
                "โครงสร้างข้อมูลและขั้นตอนวิธี",
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
        cs201Section.setPrerequisiteCourseCodes("CS101");
    }

    @Test
    @DisplayName("Registration Check: When section has no prerequisites, validation passes ok")
    void testRegistrationCheck_whenNoPrerequisite_passesOk() {
        cs201Section.setPrerequisiteCourseCodes(null);
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertTrue(check.ok());
        assertTrue(check.valid());
        assertTrue(check.getErrors().isEmpty());
        verify(courseGradeRepository, never()).findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(anyString());
    }

    @Test
    @DisplayName("Registration Check: Blocked when prerequisite is not in student grade history")
    void testRegistrationCheck_whenPrerequisiteNotPassed_failsWithSpecificError() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of());

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertFalse(check.ok());
        assertFalse(check.valid());
        assertEquals(1, check.getErrors().size());
        assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
    }

    @Test
    @DisplayName("Registration Check: Allowed when student passed prerequisite with grade B+")
    void testRegistrationCheck_whenPrerequisitePassedWithGradeBPlus_passesOk() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        CourseGrade grade = new CourseGrade(1L, student, 2565, 1, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "B+", 3.5);
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of(grade));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertTrue(check.ok());
        assertTrue(check.valid());
        assertTrue(check.getErrors().isEmpty());
    }

    @Test
    @DisplayName("Registration Check: Blocked when prerequisite attempt has failing grade F")
    void testRegistrationCheck_whenPrerequisiteHasGradeF_fails() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        CourseGrade grade = new CourseGrade(1L, student, 2565, 1, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "F", 0.0);
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of(grade));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertFalse(check.ok());
        assertFalse(check.valid());
        assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
    }

    @Test
    @DisplayName("Registration Check: Blocked when prerequisite attempt has unreleased grade or W/I/U")
    void testRegistrationCheck_whenPrerequisiteHasUnreleasedOrWithdrawnGrade_fails() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        CourseGrade unreleased = new CourseGrade(1L, student, 2565, 1, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "ยังไม่ออกผล", null);
        CourseGrade withdrawn = new CourseGrade(2L, student, 2565, 2, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "W", null);
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of(unreleased, withdrawn));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertFalse(check.ok());
        assertFalse(check.valid());
        assertTrue(check.getErrors().get(0).contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
    }

    @Test
    @DisplayName("Registration Check: Repeated course with F first attempt then C second attempt is satisfied")
    void testRegistrationCheck_whenRepeatedCoursePassedOnSecondAttempt_passesOk() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        CourseGrade attempt1 = new CourseGrade(1L, student, 2565, 1, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "F", 0.0);
        CourseGrade attempt2 = new CourseGrade(2L, student, 2565, 2, "CS101", "การเขียนโปรแกรมคอมพิวเตอร์ 1", 3, "C", 2.0);
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of(attempt2, attempt1));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertTrue(check.ok());
        assertTrue(check.valid());
        assertTrue(check.getErrors().isEmpty());
    }

    @Test
    @DisplayName("Registration Check: Multiple prerequisites list only missing courses")
    void testRegistrationCheck_multiplePrerequisites_listsOnlyMissingCodes() {
        cs201Section.setPrerequisiteCourseCodes("CS101, CS102, CS103");
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));

        CourseGrade g1 = new CourseGrade(1L, student, 2565, 1, "CS101", "Programming 1", 3, "B", 3.0);
        CourseGrade g3 = new CourseGrade(2L, student, 2565, 2, "CS103", "Discrete Math", 3, "D+", 1.5);
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of(g1, g3));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));
        RegistrationCheck check = timetableService.checkRegistration(studentActor, studentId, req);

        assertFalse(check.ok());
        assertEquals(1, check.getErrors().size());
        assertEquals("ไม่ผ่านวิชาบังคับก่อน: CS102", check.getErrors().get(0));
    }

    @Test
    @DisplayName("Submit Registration: Throws TimetableException (and IllegalArgumentException) when prereq not met")
    void testSubmitRegistration_whenPrerequisiteNotMet_throwsConflictException() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of());

        RegistrationPeriod openPeriod = new RegistrationPeriod(
                1L, 2566, 1,
                LocalDateTime.now().minusDays(1),
                LocalDateTime.now().plusDays(5),
                false
        );
        when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

        RegistrationCartRequest req = new RegistrationCartRequest(2566, 1, List.of("CS201"));

        TimetableException ex = assertThrows(TimetableException.class, () ->
                timetableService.submitRegistration(studentActor, studentId, req)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("ไม่ผ่านวิชาบังคับก่อน: CS101"));
        assertInstanceOf(IllegalArgumentException.class, (Throwable) ex, "TimetableException must inherit from IllegalArgumentException");
    }

    @Test
    @DisplayName("Enroll: Blocked when prerequisite is not met")
    void testEnroll_whenPrerequisiteNotMet_throwsConflictException() {
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2566, 1, "CS201"))
                .thenReturn(List.of(cs201Section));
        when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                .thenReturn(List.of());

        RegistrationPeriod openPeriod = new RegistrationPeriod(
                1L, 2566, 1,
                LocalDateTime.now().minusDays(1),
                LocalDateTime.now().plusDays(5),
                false
        );
        when(periodRepository.findByAcademicYearAndTerm(2566, 1)).thenReturn(Optional.of(openPeriod));

        EnrollmentRequest req = new EnrollmentRequest();
        req.setCourseCode("CS201");
        req.setAcademicYear(2566);
        req.setTerm(1);

        assertThrows(IllegalArgumentException.class, () ->
                timetableService.enroll(studentActor, studentId, req)
        );
    }
}
