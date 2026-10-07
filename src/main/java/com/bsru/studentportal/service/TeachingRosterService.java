package com.bsru.studentportal.service;

import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.InstructorGrade;
import com.bsru.studentportal.repository.InstructorGradeRepository;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * What a teacher may see about the students in the sections they teach (every year and term): only data
 * that belongs to that course — enrollment, Sec and the grade of that course. Simulated (sample) students
 * are left out.
 */
@Service
@RequiredArgsConstructor
public class TeachingRosterService {

    public record TaughtStudent(String studentId, String nameTh, Integer year, String studentSection,
                                EnrollmentStatus enrollmentStatus, String grade, Double gradePoint,
                                boolean advisee) {}

    public record TaughtSection(Long sectionId, int academicYear, int term, String courseCode, String courseName,
                                int credits, String sectionNo, String dayName, String startTime, String endTime,
                                String room, ClassSection.ApprovalStatus approvalStatus,
                                List<TaughtStudent> students) {}

    private static final List<EnrollmentStatus> ACTIVE = List.of(EnrollmentStatus.CONFIRMED, EnrollmentStatus.PENDING);

    private final ClassSectionRepository sectionRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final CourseGradeRepository gradeRepository;
    private final InstructorGradeRepository instructorGradeRepository;

    private static final Map<String, Double> GRADE_POINTS = Map.of(
            "A", 4.0, "B+", 3.5, "B", 3.0, "C+", 2.5, "C", 2.0, "D+", 1.5, "D", 1.0, "F", 0.0);

    /** Every section this advisor teaches, newest term first, with its (real) students */
    @Transactional(readOnly = true)
    public List<TaughtSection> sectionsTaughtBy(String advisorId) {
        Map<String, List<CourseGrade>> gradesByStudent = new HashMap<>();
        return sectionRepository.findByInstructorIdOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc(advisorId)
                .stream()
                .map(sec -> toView(sec, advisorId, gradesByStudent))
                .toList();
    }

    /** Every section of every teacher (demo advisor login only) */
    @Transactional(readOnly = true)
    public List<TaughtSection> allSections(String advisorId) {
        Map<String, List<CourseGrade>> gradesByStudent = new HashMap<>();
        return sectionRepository.findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc().stream()
                .map(sec -> toView(sec, advisorId, gradesByStudent))
                .toList();
    }

    private TaughtSection toView(ClassSection sec, String advisorId, Map<String, List<CourseGrade>> gradesByStudent) {
        List<TaughtStudent> students = enrollmentRepository.findBySectionIdAndStatusIn(sec.getId(), ACTIVE).stream()
                .filter(e -> !e.getStudent().isSimulated())
                .map(e -> toStudent(e, sec, advisorId, gradesByStudent))
                .sorted(Comparator.comparing(TaughtStudent::studentId))
                .toList();
        return new TaughtSection(sec.getId(), sec.getAcademicYear(), sec.getTerm(), sec.getCourseCode(),
                sec.getCourseName(), sec.getCredits(), sec.getSectionNo(),
                TimetableService.DAY_NAMES_TH[sec.getDayOfWeek()], sec.getStartTime().toString(),
                sec.getEndTime().toString(), sec.getRoom(), sec.getApprovalStatus(), students);
    }

    private TaughtStudent toStudent(SectionEnrollment e, ClassSection sec, String advisorId,
                                    Map<String, List<CourseGrade>> gradesByStudent) {
        Student s = e.getStudent();
        // Only the grade of this course in this term
        Optional<CourseGrade> grade = gradesByStudent
                .computeIfAbsent(s.getStudentId(), id -> gradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(id))
                .stream()
                .filter(g -> g.getCourseCode().equalsIgnoreCase(sec.getCourseCode())
                        && g.getAcademicYear().equals(sec.getAcademicYear()) && g.getTerm().equals(sec.getTerm()))
                .findFirst();
        boolean advisee = s.getAdvisor() != null && advisorId.equals(s.getAdvisor().getId());
        // A grade the teacher entered in this section wins (the teacher sees it before it is released)
        Optional<String> entered = instructorGradeRepository.findBySectionIdAndStudentStudentId(sec.getId(), s.getStudentId())
                .map(InstructorGrade::getGrade);
        if (entered.isPresent()) {
            return new TaughtStudent(s.getStudentId(), s.getNameTh(), s.getYear(), s.getStudentSection(), e.getStatus(),
                    entered.get(), GRADE_POINTS.get(entered.get()), advisee);
        }
        return new TaughtStudent(s.getStudentId(), s.getNameTh(), s.getYear(), s.getStudentSection(), e.getStatus(),
                grade.map(CourseGrade::getGrade).orElse(null), grade.map(CourseGrade::getGradePoint).orElse(null),
                advisee);
    }
}
