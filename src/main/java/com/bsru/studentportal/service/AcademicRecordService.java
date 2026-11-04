package com.bsru.studentportal.service;

import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.CourseGradeSchedule;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.CourseGradeScheduleRepository;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.InstructorGradeRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Reads course grades and graduation progress from the database and derives GPAs from them,
 * so the chatbot and the grades page always show the same numbers.
 */
@Service
@RequiredArgsConstructor
public class AcademicRecordService {

    public record Course(String code, String name, int credits, String grade, Double gradePoint) {}

    /** gpa is null when no course in the semester has a released grade yet */
    public record Semester(String label, int academicYear, int term, List<Course> courses,
                           int registeredCredits, int gradedCredits, Double gpa) {}

    public record GradeReport(String studentId, List<Semester> semesters, int gradedCredits, Double gpa) {
        public boolean isEmpty() {
            return semesters.isEmpty();
        }
    }

    /** A grade a teacher entered that the admin has released (counted like any other grade) */
    public record ReleasedGrade(int academicYear, int term, String courseCode, String courseName, int credits,
                                String grade, Double gradePoint) {}

    private final CourseGradeRepository courseGradeRepository;
    private final GraduationProgressRepository graduationProgressRepository;
    private final GraduationAuditService graduationAudits;
    private final InstructorGradeRepository instructorGradeRepository;
    private final CourseGradeScheduleRepository gradeScheduleRepository;
    private final SectionEnrollmentRepository enrollmentRepository;

    /**
     * Grades by semester. The graduation audit holds every course the student took, so when a student
     * has one it is the source (same GPA as the profile, the graduation page and the advisor);
     * the course_grades table is only used for students without an audit. Grades teachers entered are
     * added once the admin releases them, replacing the same course in the same term.
     */
    @Transactional(readOnly = true)
    public GradeReport gradesOf(String studentId) {
        Optional<JsonNode> audit = graduationAudits.auditOf(studentId).map(GraduationAuditService.AuditResult::audit);
        GradeReport base = audit.isPresent() ? fromAudit(studentId, audit.get()) : fromCourseGrades(studentId);
        return withReleasedGrades(base, releasedGradesOf(studentId));
    }

    /** Teacher grades of a student whose course is released (release time passed) and who is still enrolled */
    @Transactional(readOnly = true)
    public List<ReleasedGrade> releasedGradesOf(String studentId) {
        // Unit tests may build this service without the teacher-grade repositories
        if (instructorGradeRepository == null || gradeScheduleRepository == null) return List.of();
        LocalDateTime now = LocalDateTime.now();
        return instructorGradeRepository.findByStudentStudentId(studentId).stream()
                .filter(g -> {
                    ClassSection sec = g.getSection();
                    return gradeScheduleRepository
                            .findByAcademicYearAndTermAndCourseCodeIgnoreCase(sec.getAcademicYear(), sec.getTerm(), sec.getCourseCode())
                            .map(CourseGradeSchedule::getReleaseAt)
                            .filter(at -> !at.isAfter(now))
                            .isPresent();
                })
                .filter(g -> enrollmentRepository.findByStudentStudentIdAndSectionId(studentId, g.getSection().getId())
                        .filter(e -> e.getStatus() == EnrollmentStatus.CONFIRMED).isPresent())
                .map(g -> {
                    ClassSection sec = g.getSection();
                    return new ReleasedGrade(sec.getAcademicYear(), sec.getTerm(), sec.getCourseCode(), sec.getCourseName(),
                            sec.getCredits(), g.getGrade(), GRADE_POINTS.get(g.getGrade()));
                })
                .toList();
    }

    /** Valid letter grades and their points */
    public static boolean isLetterGrade(String grade) {
        return grade != null && GRADE_POINTS.containsKey(grade);
    }

    private GradeReport withReleasedGrades(GradeReport base, List<ReleasedGrade> released) {
        if (released.isEmpty()) return base;
        Map<Integer, List<Course>> byTerm = new TreeMap<>(Comparator.reverseOrder());
        for (Semester sem : base.semesters()) {
            byTerm.put(sem.academicYear() * 10 + sem.term(), new ArrayList<>(sem.courses()));
        }
        for (ReleasedGrade g : released) {
            List<Course> courses = byTerm.computeIfAbsent(g.academicYear() * 10 + g.term(), k -> new ArrayList<>());
            courses.removeIf(c -> c.code().equalsIgnoreCase(g.courseCode()));
            courses.add(new Course(g.courseCode(), g.courseName(), g.credits(), g.grade(), g.gradePoint()));
        }
        List<Semester> semesters = new ArrayList<>();
        double totalPoints = 0;
        int totalGraded = 0;
        for (Map.Entry<Integer, List<Course>> e : byTerm.entrySet()) {
            int year = e.getKey() / 10;
            int term = e.getKey() % 10;
            double points = 0;
            int graded = 0;
            int registered = 0;
            for (Course c : e.getValue()) {
                registered += c.credits();
                if (c.gradePoint() != null) {
                    points += c.gradePoint() * c.credits();
                    graded += c.credits();
                }
            }
            semesters.add(new Semester("Term " + term + "/" + year, year, term, e.getValue(), registered, graded, gpa(points, graded)));
            totalPoints += points;
            totalGraded += graded;
        }
        return new GradeReport(base.studentId(), semesters, totalGraded, gpa(totalPoints, totalGraded));
    }

    private static final Map<String, Double> GRADE_POINTS = Map.of(
            "A", 4.0, "B+", 3.5, "B", 3.0, "C+", 2.5, "C", 2.0, "D+", 1.5, "D", 1.0, "F", 0.0);

    /** Semesters from the audit's term labels ("A 2/66" = grade A in semester 2/2566, "-- 1/69" = not graded yet) */
    private GradeReport fromAudit(String studentId, JsonNode audit) {
        Map<Integer, List<Course>> byTerm = new TreeMap<>(Comparator.reverseOrder());
        collectCourses(audit.path("sections"), byTerm);

        List<Semester> semesters = new ArrayList<>();
        double totalPoints = 0;
        int totalGraded = 0;
        for (Map.Entry<Integer, List<Course>> e : byTerm.entrySet()) {
            int year = e.getKey() / 10;
            int term = e.getKey() % 10;
            double points = 0;
            int graded = 0;
            int registered = 0;
            for (Course c : e.getValue()) {
                registered += c.credits();
                if (c.gradePoint() != null) {
                    points += c.gradePoint() * c.credits();
                    graded += c.credits();
                }
            }
            semesters.add(new Semester("Term " + term + "/" + year, year, term, e.getValue(), registered, graded, gpa(points, graded)));
            totalPoints += points;
            totalGraded += graded;
        }
        return new GradeReport(studentId, semesters, totalGraded, gpa(totalPoints, totalGraded));
    }

    private static void collectCourses(JsonNode nodes, Map<Integer, List<Course>> byTerm) {
        for (JsonNode n : nodes) {
            for (JsonNode c : n.path("courses")) {
                int credits = c.path("ca").asInt(0) > 0 ? c.path("ca").asInt() : c.path("attempted").asInt(0);
                if (credits <= 0) {
                    try {
                        credits = Integer.parseInt(c.path("credits").asText().replaceAll("^(\\d+).*$", "$1"));
                    } catch (NumberFormatException ignored) {
                        credits = 0;
                    }
                }
                if (credits <= 0) continue;   // non-credit requirements (CEFR, DL) are not grades
                final int courseCredits = credits;
                c.path("terms").fields().forEachRemaining(t -> {
                    String[] parts = t.getValue().asText().trim().split("\\s+");
                    if (parts.length < 2) return;
                    String[] sem = parts[1].split("/");
                    if (sem.length != 2) return;
                    try {
                        int key = (2500 + Integer.parseInt(sem[1])) * 10 + Integer.parseInt(sem[0]);
                        String grade = GRADE_POINTS.containsKey(parts[0]) ? parts[0] : null;
                        byTerm.computeIfAbsent(key, k -> new ArrayList<>()).add(new Course(c.path("code").asText(),
                                c.path("name").asText(), courseCredits, grade, grade == null ? null : GRADE_POINTS.get(grade)));
                    } catch (NumberFormatException ignored) {
                        // not a semester label
                    }
                });
            }
            collectCourses(n.path("groups"), byTerm);
            collectCourses(n.path("subsections"), byTerm);
        }
    }

    private GradeReport fromCourseGrades(String studentId) {
        // Already sorted newest semester first
        List<CourseGrade> rows = courseGradeRepository
                .findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId);

        Map<String, List<CourseGrade>> bySemester = new LinkedHashMap<>();
        for (CourseGrade row : rows) {
            bySemester.computeIfAbsent(row.getTerm() + "/" + row.getAcademicYear(), k -> new ArrayList<>()).add(row);
        }

        List<Semester> semesters = new ArrayList<>();
        double totalPoints = 0;
        int totalGraded = 0;
        for (Map.Entry<String, List<CourseGrade>> entry : bySemester.entrySet()) {
            List<CourseGrade> semRows = entry.getValue();
            double points = 0;
            int graded = 0;
            int registered = 0;
            List<Course> courses = new ArrayList<>();
            for (CourseGrade c : semRows) {
                courses.add(new Course(c.getCourseCode(), c.getCourseName(), c.getCredits(), c.getGrade(), c.getGradePoint()));
                registered += c.getCredits();
                if (c.getGradePoint() != null) {
                    points += c.getGradePoint() * c.getCredits();
                    graded += c.getCredits();
                }
            }
            CourseGrade first = semRows.get(0);
            semesters.add(new Semester("Term " + entry.getKey(), first.getAcademicYear(), first.getTerm(),
                    courses, registered, graded, gpa(points, graded)));
            totalPoints += points;
            totalGraded += graded;
        }
        return new GradeReport(studentId, semesters, totalGraded, gpa(totalPoints, totalGraded));
    }

    @Transactional(readOnly = true)
    public Optional<GraduationProgress> graduationOf(String studentId) {
        return graduationProgressRepository.findById(studentId);
    }

    private static Double gpa(double points, int credits) {
        // Round to 2 decimals the same way the grades page displays it
        return credits == 0 ? null : Math.round(points / credits * 100.0) / 100.0;
    }
}
