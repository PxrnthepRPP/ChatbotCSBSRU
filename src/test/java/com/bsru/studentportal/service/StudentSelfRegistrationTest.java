package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.SelfRegistrationRequest;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.RegistrationPeriodRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.CourseSuggestion;
import com.bsru.studentportal.service.TimetableService.SessionView;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Students register courses themselves: confirmed straight away, saved for reuse, duplicates flagged. */
@ExtendWith(MockitoExtension.class)
class StudentSelfRegistrationTest {

    @Mock private ClassSectionRepository sectionRepository;
    @Mock private SectionEnrollmentRepository enrollmentRepository;
    @Mock private RegistrationPeriodRepository periodRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private AdvisorRepository advisorRepository;
    @Mock private NotificationService notificationService;

    private TimetableService service;
    private final String studentId = "6621100042";
    private final Actor student = new Actor(Actor.Kind.STUDENT, studentId);
    private final Advisor teacher = new Advisor("ADV-01", "อ.วิชัย", "Wichai", "w@bsru.ac.th", "0", "CS");
    private final List<SectionEnrollment> enrollments = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new TimetableService(sectionRepository, enrollmentRepository, periodRepository,
                studentRepository, advisorRepository, notificationService);
        Student s = new Student();
        s.setStudentId(studentId);
        s.setNameTh("สมชาย ใจดี");
        s.setStudentSection("D2");
        lenient().when(studentRepository.findById(studentId)).thenReturn(Optional.of(s));
        lenient().when(advisorRepository.findById("ADV-01")).thenReturn(Optional.of(teacher));
        lenient().when(enrollmentRepository.findByStudentStudentId(studentId)).thenReturn(enrollments);
        lenient().when(sectionRepository.save(any(ClassSection.class))).thenAnswer(inv -> {
            ClassSection c = inv.getArgument(0);
            c.setId(500L);
            return c;
        });
        openRegistration(true);
    }

    private void openRegistration(boolean open) {
        LocalDateTime now = LocalDateTime.now();
        RegistrationPeriod p = new RegistrationPeriod(1L, 2569, 1, now.minusDays(1),
                open ? now.plusDays(1) : now.minusHours(1), false);
        lenient().when(periodRepository.findByAcademicYearAndTerm(2569, 1)).thenReturn(Optional.of(p));
        lenient().when(periodRepository.findAll()).thenReturn(List.of(p));
    }

    private SelfRegistrationRequest request() {
        SelfRegistrationRequest r = new SelfRegistrationRequest();
        r.setAcademicYear(2569);
        r.setTerm(1);
        r.setCourseCode("cs3101");
        r.setCourseName("ปัญญาประดิษฐ์");
        r.setCredits(3);
        r.setDayOfWeek(2);
        r.setStartTime("09:30");
        r.setEndTime("11:45");
        r.setInstructorName("อ.สมศรี (อาจารย์พิเศษ)");
        return r;
    }

    private ClassSection section(long id, String code, String sec, int day, String start, String end) {
        return new ClassSection(id, 2569, 1, code, "วิชา " + code, 3, sec, day, LocalTime.parse(start),
                LocalTime.parse(end), "R1", teacher, null, ClassSection.ApprovalStatus.APPROVED, null);
    }

    @Test
    @DisplayName("New course: saved as a section with minutes and a typed teacher, student CONFIRMED at once")
    void newCourseIsSavedAndConfirmed() {
        SessionView view = service.selfRegister(student, studentId, request());

        ArgumentCaptor<ClassSection> saved = ArgumentCaptor.forClass(ClassSection.class);
        verify(sectionRepository).save(saved.capture());
        ClassSection c = saved.getValue();
        assertEquals("CS3101", c.getCourseCode());
        assertEquals("D2", c.getSectionNo(), "defaults to the student's own Sec");
        assertEquals(LocalTime.of(9, 30), c.getStartTime());
        assertEquals(LocalTime.of(11, 45), c.getEndTime());
        assertNull(c.getInstructor());
        assertEquals("อ.สมศรี (อาจารย์พิเศษ)", c.getInstructorName());
        assertNull(c.getCapacity(), "student-entered courses have no seat limit");
        assertEquals(studentId, c.getRecordedBy());
        assertEquals(ClassSection.ApprovalStatus.APPROVED, c.getApprovalStatus());

        ArgumentCaptor<SectionEnrollment> enrolled = ArgumentCaptor.forClass(SectionEnrollment.class);
        verify(enrollmentRepository).save(enrolled.capture());
        assertEquals(EnrollmentStatus.CONFIRMED, enrolled.getValue().getStatus());
        assertEquals("อ.สมศรี (อาจารย์พิเศษ)", view.instructorName());
        assertEquals(EnrollmentStatus.CONFIRMED, view.enrollmentStatus());
    }

    @Test
    @DisplayName("Teacher picked from the list is linked to the advisor account")
    void teacherFromListIsLinked() {
        SelfRegistrationRequest r = request();
        r.setInstructorId("ADV-01");
        r.setInstructorName("");
        service.selfRegister(student, studentId, r);
        ArgumentCaptor<ClassSection> saved = ArgumentCaptor.forClass(ClassSection.class);
        verify(sectionRepository).save(saved.capture());
        assertEquals("ADV-01", saved.getValue().getInstructor().getId());
        assertNull(saved.getValue().getInstructorName());
    }

    @Test
    @DisplayName("Same course + Sec already in the semester: 409 with the existing section, nothing saved")
    void duplicateIsFlagged() {
        ClassSection existing = section(77L, "CS3101", "D2", 0, "08:00", "11:00");
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2569, 1, "CS3101"))
                .thenReturn(List.of(existing));

        TimetableException e = assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, request()));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertTrue(e.getMessage().contains("อยู่ในระบบแล้ว"));
        assertEquals(77L, ((SessionView) e.getDetails()).sectionId());
        verify(sectionRepository, never()).save(any());
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("useExisting joins the section already recorded instead of creating a copy")
    void useExistingJoinsSection() {
        ClassSection existing = section(77L, "CS3101", "D2", 0, "08:00", "11:00");
        when(sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(2569, 1, "CS3101"))
                .thenReturn(List.of(existing));
        when(sectionRepository.findById(77L)).thenReturn(Optional.of(existing));
        SelfRegistrationRequest r = request();
        r.setUseExisting(true);

        SessionView view = service.selfRegister(student, studentId, r);

        assertEquals(77L, view.sectionId());
        verify(sectionRepository, never()).save(any());
        ArgumentCaptor<SectionEnrollment> enrolled = ArgumentCaptor.forClass(SectionEnrollment.class);
        verify(enrollmentRepository).save(enrolled.capture());
        assertEquals(EnrollmentStatus.CONFIRMED, enrolled.getValue().getStatus());
        assertEquals(77L, enrolled.getValue().getSection().getId());
    }

    @Test
    @DisplayName("Time clash with a course already in the student's timetable is refused")
    void clashIsRefused() {
        ClassSection mine = section(9L, "CS2001", "D2", 2, "11:00", "13:00");
        enrollments.add(new SectionEnrollment(1L, null, mine, LocalDateTime.now(), EnrollmentStatus.CONFIRMED, null));

        TimetableException e = assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, request()));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertTrue(e.getMessage().contains("CS2001"));
        verify(sectionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Registration closed: students cannot register")
    void closedPeriodIsRefused() {
        openRegistration(false);
        TimetableException e = assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, request()));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
    }

    @Test
    @DisplayName("Missing teacher or end before start is a 400")
    void validation() {
        SelfRegistrationRequest noTeacher = request();
        noTeacher.setInstructorName(" ");
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, noTeacher)).getStatus());

        SelfRegistrationRequest backwards = request();
        backwards.setEndTime("09:00");
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, backwards)).getStatus());
    }

    @Test
    @DisplayName("Course code must be English letters and digits only")
    void courseCodeIsEnglishAndDigitsOnly() {
        for (String bad : List.of("วิชา101", "CS 3101", "CS-3101", "CS3101!", "ABCDEFGHIJKLMNOPQRSTU")) {
            SelfRegistrationRequest r = request();
            r.setCourseCode(bad);
            TimetableException e = assertThrows(TimetableException.class, () -> service.selfRegister(student, studentId, r), bad);
            assertEquals(HttpStatus.BAD_REQUEST, e.getStatus(), bad);
            assertTrue(e.getMessage().contains("ภาษาอังกฤษหรือตัวเลข"), bad);
        }
        verify(sectionRepository, never()).save(any());
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("A student cannot register for someone else; advisors cannot use self-registration")
    void accessRules() {
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(TimetableException.class,
                () -> service.selfRegister(new Actor(Actor.Kind.STUDENT, "other"), studentId, request())).getStatus());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(TimetableException.class,
                () -> service.selfRegister(new Actor(Actor.Kind.ADVISOR, "ADV-01"), studentId, request())).getStatus());
    }

    @Test
    @DisplayName("Suggestions: one entry per course from its latest semester, matched by code prefix or name")
    void suggestions() {
        ClassSection newer = section(2L, "CS3101", "D1", 1, "13:00", "16:00");
        ClassSection older = new ClassSection(1L, 2568, 1, "CS3101", "ปัญญาประดิษฐ์ (เก่า)", 3, "D1", 0,
                LocalTime.of(9, 0), LocalTime.of(12, 0), null, null, null, ClassSection.ApprovalStatus.APPROVED, null);
        ClassSection other = section(3L, "GE1001", "D1", 0, "08:00", "10:00");
        when(sectionRepository.findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc())
                .thenReturn(List.of(newer, other, older));

        List<CourseSuggestion> found = service.courseSuggestions("cs31");
        assertEquals(1, found.size());
        assertEquals("CS3101", found.get(0).courseCode());
        assertEquals("13:00", found.get(0).startTime());
        assertEquals("1/2569", found.get(0).lastTaught());
        assertEquals("อ.วิชัย", found.get(0).instructorName());

        assertTrue(service.courseSuggestions(" ").isEmpty());
    }

    @Test
    @DisplayName("Registration log is admin only")
    void logIsAdminOnly() {
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(TimetableException.class,
                () -> service.registrationLog(student, null, null)).getStatus());
        when(enrollmentRepository.findAll()).thenReturn(List.of());
        assertTrue(service.registrationLog(new Actor(Actor.Kind.ADMIN, "admin"), null, null).isEmpty());
    }
}
