package com.bsru.studentportal.service;

import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGradeSchedule;
import com.bsru.studentportal.model.InstructorGrade;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.SectionGradeSubmission;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeScheduleRepository;
import com.bsru.studentportal.repository.InstructorGradeRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.SectionGradeSubmissionRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Teachers enter grades for the students of the sections they teach. They may change them any number
 * of times and must press "ส่งเกรด" before the course's deadline; any later change by the teacher needs
 * sending again. After the deadline (or once released) only the admin can change grades. The admin
 * releases a course (every Sec together) now or at a chosen time; released grades show on the
 * student's grades page and count in GPA (AcademicRecordService.releasedGradesOf).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GradeEntryService {

    public record GradeRow(String studentId, String nameTh, Integer year, String studentSection, String grade,
                           LocalDateTime updatedAt, String updatedBy) {}

    public record SectionGrades(Long sectionId, int academicYear, int term, String courseCode, String courseName,
                                int credits, String sectionNo, String instructorName,
                                LocalDateTime submitDeadline, LocalDateTime releaseAt, boolean released,
                                boolean submitted, LocalDateTime submittedAt, boolean canEdit, String lockReason,
                                int graded, List<GradeRow> rows) {}

    public record SectionStatus(Long sectionId, String sectionNo, String instructorName, int students, int graded,
                                boolean submitted, LocalDateTime submittedAt) {}

    public record CourseStatus(int academicYear, int term, String courseCode, String courseName,
                               LocalDateTime submitDeadline, LocalDateTime releaseAt, boolean released,
                               List<SectionStatus> sections) {}

    private final ClassSectionRepository sectionRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final InstructorGradeRepository gradeRepository;
    private final SectionGradeSubmissionRepository submissionRepository;
    private final CourseGradeScheduleRepository scheduleRepository;
    private final StudentRepository studentRepository;
    private final AcademicRecordService academicRecords;

    // ------------------------------------------------------------------ teacher

    @Transactional(readOnly = true)
    public SectionGrades sectionGrades(Actor actor, Long sectionId) {
        ClassSection section = findSection(sectionId);
        requireTeacherOrAdmin(actor, section);
        return view(actor, section);
    }

    /** grades: student id -> letter grade ("" or null clears it) */
    @Transactional
    public SectionGrades saveGrades(Actor actor, Long sectionId, Map<String, String> grades) {
        ClassSection section = findSection(sectionId);
        requireTeacherOrAdmin(actor, section);
        String lock = lockReason(actor, section);
        if (lock != null) throw new TimetableException(HttpStatus.FORBIDDEN, lock);
        if (grades == null || grades.isEmpty()) throw new TimetableException(HttpStatus.BAD_REQUEST, "ไม่มีเกรดที่จะบันทึก");

        Map<String, SectionEnrollment> enrolled = confirmed(section).stream()
                .collect(Collectors.toMap(e -> e.getStudent().getStudentId(), e -> e));
        boolean changed = false;
        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<String, String> entry : grades.entrySet()) {
            String studentId = entry.getKey();
            String grade = entry.getValue() == null ? "" : entry.getValue().trim().toUpperCase();
            SectionEnrollment enrollment = enrolled.get(studentId);
            if (enrollment == null) {
                throw new TimetableException(HttpStatus.BAD_REQUEST, "นักศึกษา " + studentId + " ไม่ได้ลงทะเบียน (ยืนยันแล้ว) ในกลุ่มเรียนนี้");
            }
            if (!grade.isEmpty() && !AcademicRecordService.isLetterGrade(grade)) {
                throw new TimetableException(HttpStatus.BAD_REQUEST, "เกรดของ " + studentId + " ต้องเป็น A, B+, B, C+, C, D+, D หรือ F");
            }
            Optional<InstructorGrade> existing = gradeRepository.findBySectionIdAndStudentStudentId(sectionId, studentId);
            if (grade.isEmpty()) {
                if (existing.isPresent()) {
                    gradeRepository.delete(existing.get());
                    changed = true;
                }
                continue;
            }
            if (existing.isPresent() && grade.equals(existing.get().getGrade())) continue;
            InstructorGrade g = existing.orElseGet(InstructorGrade::new);
            g.setSection(section);
            g.setStudent(enrollment.getStudent());
            g.setGrade(grade);
            g.setUpdatedAt(now);
            g.setUpdatedBy(actor.id());
            gradeRepository.save(g);
            changed = true;
        }
        // A teacher's change after sending must be sent again; an admin correction keeps the status
        if (changed && actor.kind() != Actor.Kind.ADMIN) submissionRepository.deleteById(sectionId);
        if (changed && isReleased(section)) syncGpas(enrolled.keySet());
        return view(actor, section);
    }

    @Transactional
    public SectionGrades submit(Actor actor, Long sectionId) {
        ClassSection section = findSection(sectionId);
        requireTeacherOrAdmin(actor, section);
        String lock = lockReason(actor, section);
        if (lock != null) throw new TimetableException(HttpStatus.FORBIDDEN, lock);
        Set<String> graded = gradeRepository.findBySectionId(sectionId).stream()
                .map(g -> g.getStudent().getStudentId()).collect(Collectors.toSet());
        List<String> missing = confirmed(section).stream()
                .map(e -> e.getStudent().getStudentId())
                .filter(id -> !graded.contains(id))
                .sorted().toList();
        if (!missing.isEmpty()) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "ยังไม่ได้ใส่เกรด " + missing.size() + " คน: " + String.join(", ", missing));
        }
        submissionRepository.save(new SectionGradeSubmission(sectionId, LocalDateTime.now(), actor.id()));
        return view(actor, section);
    }

    // ------------------------------------------------------------------ admin

    /** Every course of every term with its deadline, release and each Sec's progress, newest term first */
    @Transactional(readOnly = true)
    public List<CourseStatus> courseStatuses(Actor actor) {
        requireAdmin(actor);
        Map<String, List<ClassSection>> byCourse = new LinkedHashMap<>();
        sectionRepository.findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc().stream()
                .filter(s -> s.getApprovalStatus() == ClassSection.ApprovalStatus.APPROVED)
                .forEach(s -> byCourse.computeIfAbsent(s.getAcademicYear() + "/" + s.getTerm() + "/" + s.getCourseCode().toUpperCase(),
                        k -> new java.util.ArrayList<>()).add(s));
        return byCourse.values().stream().map(secs -> {
            ClassSection first = secs.get(0);
            Optional<CourseGradeSchedule> schedule = scheduleOf(first);
            List<SectionStatus> statuses = secs.stream().map(s -> new SectionStatus(s.getId(), s.getSectionNo(),
                    s.getInstructor() == null ? null : s.getInstructor().getNameTh(),
                    confirmed(s).size(), gradeRepository.findBySectionId(s.getId()).size(),
                    submissionRepository.existsById(s.getId()),
                    submissionRepository.findById(s.getId()).map(SectionGradeSubmission::getSubmittedAt).orElse(null)))
                    .toList();
            return new CourseStatus(first.getAcademicYear(), first.getTerm(), first.getCourseCode(), first.getCourseName(),
                    schedule.map(CourseGradeSchedule::getSubmitDeadline).orElse(null),
                    schedule.map(CourseGradeSchedule::getReleaseAt).orElse(null),
                    isReleased(first), statuses);
        }).toList();
    }

    /** Sets the deadline and release time of a course (null clears either); release = now releases at once */
    @Transactional
    public CourseGradeSchedule saveSchedule(Actor actor, int academicYear, int term, String courseCode,
                                            LocalDateTime submitDeadline, LocalDateTime releaseAt) {
        requireAdmin(actor);
        String code = courseCode == null ? "" : courseCode.trim();
        List<ClassSection> sections = sectionRepository
                .findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(academicYear, term, code);
        if (sections.isEmpty()) {
            throw new TimetableException(HttpStatus.NOT_FOUND, "ไม่พบวิชา " + code + " ในภาค " + term + "/" + academicYear);
        }
        CourseGradeSchedule s = scheduleRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCase(academicYear, term, code)
                .orElseGet(CourseGradeSchedule::new);
        s.setAcademicYear(academicYear);
        s.setTerm(term);
        s.setCourseCode(sections.get(0).getCourseCode());
        s.setSubmitDeadline(submitDeadline);
        s.setReleaseAt(releaseAt);
        CourseGradeSchedule saved = scheduleRepository.save(s);
        // GPA of the course's students may have changed (released now, or release withdrawn)
        syncGpas(sections.stream().flatMap(sec -> confirmed(sec).stream())
                .map(e -> e.getStudent().getStudentId()).collect(Collectors.toSet()));
        return saved;
    }

    /**
     * Keeps students.gpa (admin list, advisor dashboard) equal to the GPA with released teacher grades.
     * Also catches releases scheduled for a later time once that time passes.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void syncReleasedGpas() {
        syncGpas(gradeRepository.findAll().stream().map(g -> g.getStudent().getStudentId()).collect(Collectors.toSet()));
    }

    private void syncGpas(Set<String> studentIds) {
        for (String id : studentIds) {
            Double gpa = academicRecords.gradesOf(id).gpa();
            if (gpa == null) continue;
            studentRepository.findById(id).ifPresent(s -> {
                if (s.getGpa() == null || Math.abs(s.getGpa() - gpa) > 0.001) {
                    s.setGpa(gpa);
                    studentRepository.save(s);
                }
            });
        }
    }

    // ------------------------------------------------------------------ helpers

    private SectionGrades view(Actor actor, ClassSection section) {
        Map<String, InstructorGrade> grades = gradeRepository.findBySectionId(section.getId()).stream()
                .collect(Collectors.toMap(g -> g.getStudent().getStudentId(), g -> g));
        List<GradeRow> rows = confirmed(section).stream()
                .map(SectionEnrollment::getStudent)
                .sorted(Comparator.comparing(Student::getStudentId))
                .map(st -> {
                    InstructorGrade g = grades.get(st.getStudentId());
                    return new GradeRow(st.getStudentId(), st.getNameTh(), st.getYear(), st.getStudentSection(),
                            g == null ? null : g.getGrade(), g == null ? null : g.getUpdatedAt(), g == null ? null : g.getUpdatedBy());
                })
                .toList();
        Optional<CourseGradeSchedule> schedule = scheduleOf(section);
        Optional<SectionGradeSubmission> submission = submissionRepository.findById(section.getId());
        String lock = lockReason(actor, section);
        return new SectionGrades(section.getId(), section.getAcademicYear(), section.getTerm(), section.getCourseCode(),
                section.getCourseName(), section.getCredits(), section.getSectionNo(),
                section.getInstructor() == null ? null : section.getInstructor().getNameTh(),
                schedule.map(CourseGradeSchedule::getSubmitDeadline).orElse(null),
                schedule.map(CourseGradeSchedule::getReleaseAt).orElse(null),
                isReleased(section), submission.isPresent(), submission.map(SectionGradeSubmission::getSubmittedAt).orElse(null),
                lock == null, lock, (int) rows.stream().filter(r -> r.grade() != null).count(), rows);
    }

    /** Why this user cannot change the section's grades now, or null when they can */
    private String lockReason(Actor actor, ClassSection section) {
        if (actor.kind() == Actor.Kind.ADMIN) return null;
        if (isReleased(section)) return "ประกาศผลวิชานี้แล้ว หากต้องแก้เกรดโปรดติดต่อผู้ดูแลระบบ (แอดมิน)";
        LocalDateTime deadline = scheduleOf(section).map(CourseGradeSchedule::getSubmitDeadline).orElse(null);
        if (deadline != null && LocalDateTime.now().isAfter(deadline)) {
            return "เลยวันส่งเกรดแล้ว หากต้องแก้เกรดโปรดติดต่อผู้ดูแลระบบ (แอดมิน)";
        }
        return null;
    }

    private boolean isReleased(ClassSection section) {
        return scheduleOf(section).map(CourseGradeSchedule::getReleaseAt)
                .filter(at -> !at.isAfter(LocalDateTime.now())).isPresent();
    }

    private Optional<CourseGradeSchedule> scheduleOf(ClassSection section) {
        return scheduleRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCase(
                section.getAcademicYear(), section.getTerm(), section.getCourseCode());
    }

    private List<SectionEnrollment> confirmed(ClassSection section) {
        return enrollmentRepository.findBySectionIdAndStatusIn(section.getId(), List.of(EnrollmentStatus.CONFIRMED));
    }

    private ClassSection findSection(Long id) {
        return sectionRepository.findById(id)
                .orElseThrow(() -> new TimetableException(HttpStatus.NOT_FOUND, "ไม่พบกลุ่มเรียน id " + id));
    }

    private static void requireTeacherOrAdmin(Actor actor, ClassSection section) {
        if (actor.kind() == Actor.Kind.ADMIN) return;
        boolean teaches = actor.kind() == Actor.Kind.ADVISOR && section.getInstructor() != null
                && Objects.equals(section.getInstructor().getId(), actor.id());
        if (!teaches) throw new TimetableException(HttpStatus.FORBIDDEN, "ใส่เกรดได้เฉพาะกลุ่มเรียนที่ตนเองสอน");
    }

    private static void requireAdmin(Actor actor) {
        if (actor.kind() != Actor.Kind.ADMIN) throw new TimetableException(HttpStatus.FORBIDDEN, "เฉพาะผู้ดูแลระบบเท่านั้น");
    }
}
