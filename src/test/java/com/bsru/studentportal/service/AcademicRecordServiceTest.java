package com.bsru.studentportal.service;

import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AcademicRecordService Unit Tests")
class AcademicRecordServiceTest {

    @Mock
    private CourseGradeRepository courseGradeRepository;

    @Mock
    private GraduationProgressRepository graduationProgressRepository;

    @Mock
    private GraduationAuditService graduationAudits;

    @InjectMocks
    private AcademicRecordService academicRecordService;

    private final String studentId = "6621100042";
    private Student student;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        student = new Student();
        student.setStudentId(studentId);
        objectMapper = new ObjectMapper();
    }

    private CourseGrade createCourseGrade(int year, int term, String code, String name, int credits, String grade, Double gradePoint) {
        CourseGrade cg = new CourseGrade();
        cg.setStudent(student);
        cg.setAcademicYear(year);
        cg.setTerm(term);
        cg.setCourseCode(code);
        cg.setCourseName(name);
        cg.setCredits(credits);
        cg.setGrade(grade);
        cg.setGradePoint(gradePoint);
        return cg;
    }

    @Nested
    @DisplayName("GPA Calculation from Course Grades")
    class FromCourseGradesTests {

        @Test
        @DisplayName("Standard grade points mapping: A(4.0) to D(1.0) calculates accurate semester and cumulative GPA")
        void testStandardGradePointsMapping() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            // 1 semester with diverse passing letter grades
            List<CourseGrade> grades = List.of(
                    createCourseGrade(2566, 1, "CS101", "Intro to CS", 3, "A", 4.0),
                    createCourseGrade(2566, 1, "CS102", "Programming I", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "CS103", "Data Structures", 3, "B", 3.0),
                    createCourseGrade(2566, 1, "CS104", "Discrete Math", 3, "C+", 2.5),
                    createCourseGrade(2566, 1, "CS105", "Computer Architecture", 3, "C", 2.0),
                    createCourseGrade(2566, 1, "GE101", "Thai for Comm", 2, "D+", 1.5),
                    createCourseGrade(2566, 1, "GE102", "English I", 2, "D", 1.0)
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            assertFalse(report.isEmpty());
            assertEquals(1, report.semesters().size());

            AcademicRecordService.Semester semester = report.semesters().get(0);
            assertEquals("Term 1/2566", semester.label());
            assertEquals(2566, semester.academicYear());
            assertEquals(1, semester.term());
            assertEquals(19, semester.registeredCredits());
            assertEquals(19, semester.gradedCredits());

            // Points: 3*4.0 + 3*3.5 + 3*3.0 + 3*2.5 + 3*2.0 + 2*1.5 + 2*1.0
            // = 12.0 + 10.5 + 9.0 + 7.5 + 6.0 + 3.0 + 2.0 = 50.0
            // GPA = 50.0 / 19 = 2.631578... -> rounded to 2.63
            assertEquals(2.63, semester.gpa());
            assertEquals(19, report.gradedCredits());
            assertEquals(2.63, report.gpa());
        }

        @Test
        @DisplayName("Failing grade (F=0.0): adds zero quality points but contributes to graded credits divisor, lowering GPA")
        void testFailingGradeIncreasesDivisorAndLowersGpa() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            // Course A: 3 credits @ 4.0 = 12.0 points
            // Course F: 3 credits @ 0.0 = 0.0 points
            List<CourseGrade> grades = List.of(
                    createCourseGrade(2566, 1, "CS101", "Intro to CS", 3, "A", 4.0),
                    createCourseGrade(2566, 1, "CS102", "Programming I", 3, "F", 0.0)
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            AcademicRecordService.Semester semester = report.semesters().get(0);

            // Registered: 6, Graded: 6, Points: 12.0 -> GPA = 12.0 / 6 = 2.00
            assertEquals(6, semester.registeredCredits());
            assertEquals(6, semester.gradedCredits());
            assertEquals(2.00, semester.gpa());
            assertEquals(6, report.gradedCredits());
            assertEquals(2.00, report.gpa());
        }

        @Test
        @DisplayName("Excluding 'W', 'ยังไม่ออกผล', and null grades: excluded from gradedCredits & points but counted in registeredCredits")
        void testExcludingWithdrawnAndUnreleasedGrades() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            List<CourseGrade> grades = List.of(
                    createCourseGrade(2566, 2, "CS201", "Algorithms", 3, "A", 4.0),
                    createCourseGrade(2566, 2, "CS202", "Database Systems", 3, "W", null),
                    createCourseGrade(2566, 2, "CS203", "Software Engineering", 3, "ยังไม่ออกผล", null),
                    createCourseGrade(2566, 2, "CS204", "Operating Systems", 3, null, null)
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            AcademicRecordService.Semester semester = report.semesters().get(0);

            // Total registered: 3 + 3 + 3 + 3 = 12 credits
            // Only CS201 is graded: 3 credits @ 4.0 = 12.0 points
            assertEquals(12, semester.registeredCredits());
            assertEquals(3, semester.gradedCredits());
            assertEquals(4.00, semester.gpa());

            assertEquals(3, report.gradedCredits());
            assertEquals(4.00, report.gpa());

            // Verify individual course representations
            assertEquals(4, semester.courses().size());
            AcademicRecordService.Course cW = semester.courses().get(1);
            assertEquals("CS202", cW.code());
            assertEquals("W", cW.grade());
            assertNull(cW.gradePoint());

            AcademicRecordService.Course cPending = semester.courses().get(2);
            assertEquals("CS203", cPending.code());
            assertEquals("ยังไม่ออกผล", cPending.grade());
            assertNull(cPending.gradePoint());

            AcademicRecordService.Course cNull = semester.courses().get(3);
            assertEquals("CS204", cNull.code());
            assertNull(cNull.grade());
            assertNull(cNull.gradePoint());
        }

        @Test
        @DisplayName("All courses unreleased in semester: registeredCredits > 0, gradedCredits == 0, GPA is null (no NaN/DivByZero)")
        void testAllCoursesUnreleasedReturnsNullGpa() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            List<CourseGrade> grades = List.of(
                    createCourseGrade(2566, 2, "CS301", "Cloud Computing", 3, "ยังไม่ออกผล", null),
                    createCourseGrade(2566, 2, "CS302", "Mobile App Dev", 3, "W", null)
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            AcademicRecordService.Semester semester = report.semesters().get(0);
            assertEquals(6, semester.registeredCredits());
            assertEquals(0, semester.gradedCredits());
            assertNull(semester.gpa(), "Semester GPA must be null when graded credits is 0");
            assertEquals(0, report.gradedCredits());
            assertNull(report.gpa(), "Report cumulative GPA must be null when total graded credits is 0");
        }

        @Test
        @DisplayName("Empty grades handling: returns empty GradeReport with isEmpty() true and null GPA")
        void testEmptyGradesHandling() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(Collections.emptyList());

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            assertEquals(studentId, report.studentId());
            assertTrue(report.isEmpty());
            assertTrue(report.semesters().isEmpty());
            assertEquals(0, report.gradedCredits());
            assertNull(report.gpa());
        }

        @Test
        @DisplayName("Multi-semester cumulative GPA: weighted by credits, not unweighted average of semester GPAs")
        void testMultiSemesterCreditWeightedGpa() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            // Semester 1 (2/2566): 6 credits @ 2.00 = 12.0 points (Semester GPA = 2.00)
            // Semester 2 (1/2566): 18 credits @ 3.50 = 63.0 points (Semester GPA = 3.50)
            // If unweighted: (2.00 + 3.50) / 2 = 2.75
            // Credit-weighted: (12.0 + 63.0) / (6 + 18) = 75.0 / 24 = 3.125 -> rounds to 3.13!
            List<CourseGrade> grades = List.of(
                    // Term 2/2566
                    createCourseGrade(2566, 2, "CS201", "Algorithms", 3, "C", 2.0),
                    createCourseGrade(2566, 2, "CS202", "Databases", 3, "C", 2.0),
                    // Term 1/2566
                    createCourseGrade(2566, 1, "CS101", "Intro CS", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "CS102", "Prog I", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "CS103", "Data Struct", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "CS104", "Math", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "GE101", "Thai", 3, "B+", 3.5),
                    createCourseGrade(2566, 1, "GE102", "English", 3, "B+", 3.5)
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            assertEquals(2, report.semesters().size());

            AcademicRecordService.Semester sem2 = report.semesters().get(0);
            assertEquals("Term 2/2566", sem2.label());
            assertEquals(6, sem2.gradedCredits());
            assertEquals(2.00, sem2.gpa());

            AcademicRecordService.Semester sem1 = report.semesters().get(1);
            assertEquals("Term 1/2566", sem1.label());
            assertEquals(18, sem1.gradedCredits());
            assertEquals(3.50, sem1.gpa());

            assertEquals(24, report.gradedCredits());
            assertEquals(3.13, report.gpa(), "Cumulative GPA must be credit-weighted (3.13), not unweighted average (2.75)");
        }

        @Test
        @DisplayName("2-decimal precision rounding: correctly rounds halves up / down according to Math.round(* 100.0) / 100.0")
        void testTwoDecimalPrecisionRounding() {
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.empty());

            // 28.5 points / 9 credits = 3.166666... -> 3.17
            List<CourseGrade> grades = List.of(
                    createCourseGrade(2566, 1, "C1", "Course 1", 3, "B+", 3.5), // 10.5
                    createCourseGrade(2566, 1, "C2", "Course 2", 3, "B", 3.0),  // 9.0
                    createCourseGrade(2566, 1, "C3", "Course 3", 3, "B", 3.0)   // 9.0 -> sum = 28.5
            );
            when(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId))
                    .thenReturn(grades);

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertEquals(3.17, report.gpa());
            assertEquals(3.17, report.semesters().get(0).gpa());
        }
    }

    @Nested
    @DisplayName("Audit GPA Resolution (fromAudit)")
    class FromAuditTests {

        @Test
        @DisplayName("Audit precedence: uses stored graduation audit sheet if present, ignores courseGradeRepository")
        void testAuditPrecedenceOverCourseGrades() throws Exception {
            String auditJson = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "groups": [
                        {
                          "courses": [
                            {
                              "code": "GE101",
                              "name": "ภาษาไทยเพื่อการสื่อสาร",
                              "ca": 3,
                              "attempted": 3,
                              "terms": { "term1": "A 1/66" }
                            },
                            {
                              "code": "GE102",
                              "name": "ภาษาอังกฤษเพื่อการสื่อสาร",
                              "ca": 3,
                              "attempted": 3,
                              "terms": { "term1": "B 1/66" }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;
            GraduationAuditService.AuditResult auditResult = new GraduationAuditService.AuditResult(
                    objectMapper.readTree(auditJson),
                    Collections.emptyList()
            );
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.of(auditResult));

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            assertFalse(report.isEmpty());
            assertEquals(1, report.semesters().size());

            AcademicRecordService.Semester sem = report.semesters().get(0);
            assertEquals("Term 1/2566", sem.label());
            assertEquals(2566, sem.academicYear());
            assertEquals(1, sem.term());
            assertEquals(6, sem.registeredCredits());
            assertEquals(6, sem.gradedCredits());
            // Points: 3*4.0 + 3*3.0 = 21.0 -> 21.0 / 6 = 3.50
            assertEquals(3.50, sem.gpa());
            assertEquals(3.50, report.gpa());

            // CourseGradeRepository must never be queried when audit is present
            verify(courseGradeRepository, never()).findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(anyString());
        }

        @Test
        @DisplayName("Audit parsing: skips non-credit requirements (credits <= 0) and unreleased term markers ('--')")
        void testAuditSkipsNonCreditAndHandlesUnreleasedTerms() throws Exception {
            String auditJson = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาบังคับ",
                      "groups": [
                        {
                          "courses": [
                            {
                              "code": "CEFR01",
                              "name": "การสอบมาตรฐานภาษาอังกฤษ",
                              "ca": 0,
                              "attempted": 0,
                              "credits": "0",
                              "terms": { "term1": "PASS 1/66" }
                            },
                            {
                              "code": "CS101",
                              "name": "การโปรแกรมคอมพิวเตอร์",
                              "ca": 3,
                              "attempted": 3,
                              "terms": { "term1": "A 1/66" }
                            },
                            {
                              "code": "CS102",
                              "name": "โครงสร้างข้อมูล",
                              "ca": 3,
                              "attempted": 3,
                              "terms": { "term1": "-- 2/66" }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;
            GraduationAuditService.AuditResult auditResult = new GraduationAuditService.AuditResult(
                    objectMapper.readTree(auditJson),
                    Collections.emptyList()
            );
            when(graduationAudits.auditOf(studentId)).thenReturn(Optional.of(auditResult));

            AcademicRecordService.GradeReport report = academicRecordService.gradesOf(studentId);

            assertNotNull(report);
            assertEquals(2, report.semesters().size());

            // Term 2/2566 contains CS102 with "-- 2/66" (grade is null)
            AcademicRecordService.Semester sem2 = report.semesters().get(0);
            assertEquals("Term 2/2566", sem2.label());
            assertEquals(3, sem2.registeredCredits());
            assertEquals(0, sem2.gradedCredits());
            assertNull(sem2.gpa());

            // Term 1/2566 contains CS101 with "A 1/66" (CEFR01 skipped due to credits <= 0)
            AcademicRecordService.Semester sem1 = report.semesters().get(1);
            assertEquals("Term 1/2566", sem1.label());
            assertEquals(1, sem1.courses().size());
            assertEquals("CS101", sem1.courses().get(0).code());
            assertEquals(3, sem1.registeredCredits());
            assertEquals(3, sem1.gradedCredits());
            assertEquals(4.00, sem1.gpa());

            assertEquals(3, report.gradedCredits());
            assertEquals(4.00, report.gpa());
        }
    }

    @Nested
    @DisplayName("Graduation Progress Retrieval")
    class GraduationProgressTests {

        @Test
        @DisplayName("graduationOf: delegates to graduationProgressRepository")
        void testGraduationOfDelegation() {
            GraduationProgress progress = new GraduationProgress();
            progress.setStudentId(studentId);
            progress.setCoreRequired(72);
            progress.setCoreEarned(60);

            when(graduationProgressRepository.findById(studentId)).thenReturn(Optional.of(progress));

            Optional<GraduationProgress> result = academicRecordService.graduationOf(studentId);

            assertTrue(result.isPresent());
            assertEquals(studentId, result.get().getStudentId());
            assertEquals(72, result.get().getCoreRequired());
            assertEquals(60, result.get().getCoreEarned());

            verify(graduationProgressRepository).findById(studentId);
        }

        @Test
        @DisplayName("graduationOf: returns empty when student progress not found")
        void testGraduationOfNotFound() {
            when(graduationProgressRepository.findById("UNKNOWN")).thenReturn(Optional.empty());

            Optional<GraduationProgress> result = academicRecordService.graduationOf("UNKNOWN");

            assertTrue(result.isEmpty());
            verify(graduationProgressRepository).findById("UNKNOWN");
        }
    }
}
