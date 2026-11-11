package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.EnrollmentRequest;
import com.bsru.studentportal.dto.RegistrationCartRequest;
import com.bsru.studentportal.dto.RegistrationPeriodRequest;
import com.bsru.studentportal.dto.SectionRequest;
import com.bsru.studentportal.dto.SelfRegistrationRequest;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.ClassSection.ApprovalStatus;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.RegistrationPeriodRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Timetables, class sections and registration periods. Every rule (who may change what, when
 * students may add or drop, time clashes, seat limits) lives here so the REST API, the web page
 * and the chatbot all see the same data and the same answers.
 *
 * Registration flow (no approval step): while registration is open a student registers a course
 * themselves by typing its code, name, credits, teacher, day and start-end time. The course is saved
 * as a class section and the student is enrolled straight away (CONFIRMED). Sections saved earlier are
 * offered as suggestions to later students, and typing a course + Sec that already exists in the
 * semester joins that section instead of creating a copy. Teachers and admins can still create
 * sections, also without approval. The admin keeps the registration log and can edit any section.
 */
@Service
public class TimetableService {

    public static final String[] DAY_NAMES_TH = {"จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"};
    /** Student groups; a class section is offered to exactly one group */
    public static final List<String> STUDENT_GROUPS = List.of("D1", "D2");
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final java.util.regex.Pattern COURSE_CODE = java.util.regex.Pattern.compile("^[A-Z0-9]{1,20}$");
    /** Enrollments that take a seat and appear in the timetable */
    private static final Set<EnrollmentStatus> ACTIVE = EnumSet.of(EnrollmentStatus.PENDING, EnrollmentStatus.CONFIRMED);
    private static final Comparator<ClassSection> SECTION_ORDER =
            Comparator.comparing(ClassSection::getAcademicYear).reversed()
                    .thenComparing(Comparator.comparing(ClassSection::getTerm).reversed())
                    .thenComparing(ClassSection::getDayOfWeek)
                    .thenComparing(ClassSection::getStartTime);

    /** Who is making the change; built by the controller from the verified JWT. */
    public record Actor(Kind kind, String id) {
        public enum Kind { ADMIN, ADVISOR, STUDENT }
    }

    /** A class section; enrollmentStatus is set only when the section is shown as part of a student's timetable */
    public record SessionView(Long sectionId, int academicYear, int term, String courseCode, String courseName,
                              int credits, String sectionNo, int dayOfWeek, String dayName,
                              String startTime, String endTime, String room,
                              String instructorId, String instructorName, String instructorEmail,
                              Integer capacity, long enrolledCount,
                              ApprovalStatus approvalStatus, String reviewNote,
                              EnrollmentStatus enrollmentStatus, String recordedBy) {}

    public record RegistrationStatus(Long id, int academicYear, int term, LocalDateTime opensAt,
                                     LocalDateTime closesAt, boolean forceClosed, boolean open) {}

    /** A registration request the admin turned down, kept so the student can see why */
    public record RejectedRequest(Long sectionId, String courseCode, String courseName, String sectionNo, String note) {}

    public record TermTimetable(int academicYear, int term, String label, List<SessionView> sessions,
                                int totalCredits, List<String> conflicts, RegistrationStatus registration,
                                List<RejectedRequest> rejected) {}

    /**
     * One course in a student's cart: the Sec it goes into (null when the course or the picked Sec is not
     * offered) and every approved Sec of the course the student can switch to
     */
    public record CartItem(String courseCode, SessionView section, Long seatsLeft, List<String> problems,
                           List<SessionView> choices) {}

    public record RegistrationCheck(String studentSection, int academicYear, int term, List<CartItem> items,
                                    int totalCredits, boolean ok) {
        @com.fasterxml.jackson.annotation.JsonProperty("valid")
        public boolean valid() {
            return ok;
        }

        public List<String> getErrors() {
            if (items == null) return List.of();
            return items.stream()
                    .filter(i -> i.problems() != null)
                    .flatMap(i -> i.problems().stream())
                    .toList();
        }
    }

    /** One registration in the admin's registration log */
    public record RegistrationRecord(Long enrollmentId, String studentId, String studentName, String studentSection,
                                     SessionView section, EnrollmentStatus status, LocalDateTime registeredAt) {}

    /** A course recorded before, offered to fill in the registration form (latest semester first) */
    public record CourseSuggestion(String courseCode, String courseName, int credits, String instructorId,
                                   String instructorName, String room, int dayOfWeek, String startTime,
                                   String endTime, String lastTaught) {}

    @Getter
    public static class TimetableException extends IllegalArgumentException {
        private final HttpStatus status;
        /** Optional extra payload for the client, e.g. the failed cart check */
        private final Object details;

        public TimetableException(HttpStatus status, String message) {
            this(status, message, null);
        }

        public TimetableException(HttpStatus status, String message, Object details) {
            super(message);
            this.status = status;
            this.details = details;
        }
    }

    private static final Set<String> NON_PASSING_GRADES = Set.of("F", "W", "I", "U", "ยังไม่ออกผล");

    private final ClassSectionRepository sectionRepository;
    private final com.bsru.studentportal.repository.InstructorGradeRepository instructorGradeRepository;
    private final com.bsru.studentportal.repository.SectionGradeSubmissionRepository gradeSubmissionRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final RegistrationPeriodRepository periodRepository;
    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final NotificationService notificationService;
    private final CourseGradeRepository courseGradeRepository;

    public TimetableService(ClassSectionRepository sectionRepository,
                            SectionEnrollmentRepository enrollmentRepository,
                            RegistrationPeriodRepository periodRepository,
                            StudentRepository studentRepository,
                            AdvisorRepository advisorRepository,
                            NotificationService notificationService) {
        this(sectionRepository, enrollmentRepository, periodRepository, studentRepository, advisorRepository, notificationService, null);
    }

    public TimetableService(ClassSectionRepository sectionRepository,
                            SectionEnrollmentRepository enrollmentRepository,
                            RegistrationPeriodRepository periodRepository,
                            StudentRepository studentRepository,
                            AdvisorRepository advisorRepository,
                            NotificationService notificationService,
                            CourseGradeRepository courseGradeRepository) {
        this(sectionRepository, enrollmentRepository, periodRepository, studentRepository, advisorRepository,
                notificationService, courseGradeRepository, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TimetableService(ClassSectionRepository sectionRepository,
                            SectionEnrollmentRepository enrollmentRepository,
                            RegistrationPeriodRepository periodRepository,
                            StudentRepository studentRepository,
                            AdvisorRepository advisorRepository,
                            NotificationService notificationService,
                            @org.springframework.beans.factory.annotation.Autowired(required = false) CourseGradeRepository courseGradeRepository,
                            @org.springframework.beans.factory.annotation.Autowired(required = false) com.bsru.studentportal.repository.InstructorGradeRepository instructorGradeRepository,
                            @org.springframework.beans.factory.annotation.Autowired(required = false) com.bsru.studentportal.repository.SectionGradeSubmissionRepository gradeSubmissionRepository) {
        this.instructorGradeRepository = instructorGradeRepository;
        this.gradeSubmissionRepository = gradeSubmissionRepository;
        this.sectionRepository = sectionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.periodRepository = periodRepository;
        this.studentRepository = studentRepository;
        this.advisorRepository = advisorRepository;
        this.notificationService = notificationService;
        this.courseGradeRepository = courseGradeRepository;
    }

    // ------------------------------------------------------------------ reading

    @Transactional(readOnly = true)
    public List<TermTimetable> timetableOf(String studentId) {
        Map<String, List<SectionEnrollment>> byTerm = new LinkedHashMap<>();
        enrollmentRepository.findByStudentStudentId(studentId).stream()
                .sorted(Comparator.comparing(SectionEnrollment::getSection, SECTION_ORDER))
                .forEach(e -> byTerm.computeIfAbsent(termKey(e.getSection()), k -> new ArrayList<>()).add(e));

        LocalDateTime now = LocalDateTime.now();
        List<TermTimetable> result = new ArrayList<>();
        for (Map.Entry<String, List<SectionEnrollment>> entry : byTerm.entrySet()) {
            ClassSection first = entry.getValue().get(0).getSection();
            List<SectionEnrollment> active = entry.getValue().stream().filter(e -> ACTIVE.contains(e.getStatus())).toList();
            List<ClassSection> sections = active.stream().map(SectionEnrollment::getSection).toList();
            RegistrationStatus registration = periodRepository
                    .findByAcademicYearAndTerm(first.getAcademicYear(), first.getTerm())
                    .map(p -> toStatus(p, now)).orElse(null);
            List<RejectedRequest> rejected = entry.getValue().stream()
                    .filter(e -> e.getStatus() == EnrollmentStatus.REJECTED)
                    .map(e -> new RejectedRequest(e.getSection().getId(), e.getSection().getCourseCode(),
                            e.getSection().getCourseName(), e.getSection().getSectionNo(), e.getReviewNote()))
                    .toList();
            result.add(new TermTimetable(first.getAcademicYear(), first.getTerm(), "Term " + entry.getKey(),
                    active.stream().map(e -> toView(e.getSection(), e.getStatus())).toList(),
                    sections.stream().mapToInt(ClassSection::getCredits).sum(),
                    findConflicts(sections), registration, rejected));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<SessionView> listSections(Integer academicYear, Integer term) {
        List<ClassSection> sections = (academicYear != null && term != null)
                ? sectionRepository.findByAcademicYearAndTermOrderByCourseCodeAscSectionNoAsc(academicYear, term)
                : sectionRepository.findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc();
        return sections.stream().map(this::toView).toList();
    }

    /** Sections the caller manages: a teacher's own sections, or every section for an admin */
    @Transactional(readOnly = true)
    public List<SessionView> sectionsManagedBy(Actor actor) {
        return switch (actor.kind()) {
            case ADMIN -> listSections(null, null);
            case ADVISOR -> sectionRepository
                    .findByInstructorIdOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc(actor.id())
                    .stream().map(this::toView).toList();
            case STUDENT -> throw new TimetableException(HttpStatus.FORBIDDEN, "เฉพาะอาจารย์และผู้ดูแลระบบเท่านั้น");
        };
    }

    /** A section offered in a semester that has a registration period, checked against one student's timetable */
    public record OfferedSection(SessionView section, boolean alreadyEnrolled, String clashesWith) {}

    /**
     * Every approved Sec of each course in semesters that have a registration period; for a course the
     * student already has, only the Sec they are in
     */
    @Transactional(readOnly = true)
    public List<OfferedSection> offeredSectionsFor(String studentId, String courseCode) {
        String code = courseCode == null ? "" : courseCode.trim();
        List<OfferedSection> result = new ArrayList<>();
        for (RegistrationPeriod p : periodRepository.findAllByOrderByAcademicYearDescTermDesc()) {
            List<ClassSection> mine = enrolledSections(studentId, p.getAcademicYear(), p.getTerm());
            List<ClassSection> offered = code.isEmpty()
                    ? sectionRepository.findByAcademicYearAndTermOrderByCourseCodeAscSectionNoAsc(p.getAcademicYear(), p.getTerm())
                    : sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(
                            p.getAcademicYear(), p.getTerm(), code);
            Map<String, List<ClassSection>> byCourse = offered.stream()
                    .filter(s -> s.getApprovalStatus() == ApprovalStatus.APPROVED)
                    .collect(Collectors.groupingBy(ClassSection::getCourseCode, LinkedHashMap::new, Collectors.toList()));
            for (List<ClassSection> sections : byCourse.values()) {
                Optional<ClassSection> taken = sections.stream()
                        .filter(c -> mine.stream().anyMatch(m -> m.getId().equals(c.getId()))).findFirst();
                if (taken.isPresent()) {
                    result.add(new OfferedSection(toView(taken.get()), true, null));
                    continue;
                }
                for (ClassSection s : sections) {
                    String clash = mine.stream().filter(m -> overlaps(s, m))
                            .map(m -> m.getCourseCode() + " " + m.getCourseName()).findFirst().orElse(null);
                    result.add(new OfferedSection(toView(s), false, clash));
                }
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, String>> studentsInSection(Actor actor, Long sectionId) {
        ClassSection section = findSection(sectionId);
        requireCanManage(actor, section);
        return enrollmentRepository.findBySectionIdAndStatusIn(sectionId, ACTIVE).stream()
                .sorted(Comparator.comparing(e -> e.getStudent().getStudentId()))
                .map(e -> {
                    Student st = e.getStudent();
                    Map<String, String> row = new LinkedHashMap<>();
                    row.put("studentId", st.getStudentId() != null ? st.getStudentId() : "");
                    row.put("nameTh", st.getNameTh() != null ? st.getNameTh() : "");
                    row.put("nameEn", st.getNameEn() != null ? st.getNameEn() : "");
                    row.put("year", st.getYear() != null ? String.valueOf(st.getYear()) : "");
                    row.put("studentSection", st.getStudentSection() != null ? st.getStudentSection() : "");
                    row.put("email", st.getEmail() != null ? st.getEmail() : "");
                    row.put("phone", st.getPhone() != null ? st.getPhone() : "");
                    row.put("status", e.getStatus().name());
                    return row;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RegistrationStatus> listPeriods() {
        LocalDateTime now = LocalDateTime.now();
        return periodRepository.findAllByOrderByAcademicYearDescTermDesc().stream().map(p -> toStatus(p, now)).toList();
    }

    // ------------------------------------------------------------------ student registration (cart)

    /** Checks a cart without saving anything: the Sec of each course, seats left and every problem */
    @Transactional(readOnly = true)
    public RegistrationCheck checkRegistration(Actor actor, String studentId, RegistrationCartRequest req) {
        Student student = findStudent(studentId);
        requireStudentAccess(actor, studentId);
        if (req.getAcademicYear() == null || req.getTerm() == null) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาระบุปีการศึกษาและภาคเรียน");
        }
        int year = req.getAcademicYear();
        int term = req.getTerm();
        String group = student.getStudentSection();
        List<ClassSection> existing = enrolledSections(studentId, year, term);
        List<ClassSection> picked = new ArrayList<>();
        Set<String> seenCodes = new HashSet<>();
        List<CartItem> items = new ArrayList<>();
        Map<String, String> wantedSecs = new HashMap<>();
        if (req.getSections() != null) {
            req.getSections().forEach((c, sec) -> {
                if (c != null && !isBlank(sec)) wantedSecs.put(c.trim().toUpperCase(), sec.trim());
            });
        }

        for (String raw : req.getCourseCodes() == null ? List.<String>of() : req.getCourseCodes()) {
            String code = raw == null ? "" : raw.trim().toUpperCase();
            if (code.isEmpty()) continue;
            List<String> problems = new ArrayList<>();
            if (!seenCodes.add(code)) {
                problems.add("เลือกวิชานี้ซ้ำในรายการ");
                items.add(new CartItem(code, null, null, problems, List.of()));
                continue;
            }

            List<ClassSection> candidates = sectionRepository
                    .findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(year, term, code);
            if (candidates.isEmpty()) {
                problems.add("ไม่มีวิชา " + code + " เปิดสอนในภาคเรียน " + term + "/" + year);
                items.add(new CartItem(code, null, null, problems, List.of()));
                continue;
            }
            Optional<ClassSection> taken = existing.stream().filter(o -> o.getCourseCode().equalsIgnoreCase(code)).findFirst();
            if (taken.isPresent()) {
                problems.add("ลงทะเบียนหรือส่งคำขอวิชานี้ไว้แล้ว");
                items.add(new CartItem(code, toView(taken.get()), seatsLeft(taken.get()), problems, List.of()));
                continue;
            }
            List<SessionView> choices = candidates.stream()
                    .filter(c -> c.getApprovalStatus() == ApprovalStatus.APPROVED).map(this::toView).toList();

            ClassSection s = null;
            List<String> sectionProblems = null;
            String wanted = wantedSecs.get(code);
            if (wanted != null) {
                // The Sec the student picked, whichever one it is
                s = candidates.stream().filter(c -> c.getSectionNo().equalsIgnoreCase(wanted)).findFirst().orElse(null);
                if (s == null) {
                    problems.add("วิชานี้ไม่มี Sec " + wanted + " (เปิด Sec "
                            + candidates.stream().map(ClassSection::getSectionNo).collect(Collectors.joining(", ")) + ")");
                    items.add(new CartItem(code, null, null, problems, choices));
                    continue;
                }
                sectionProblems = sectionProblems(s, code, existing, picked);
            } else {
                // Nothing picked yet: suggest the first Sec that can be taken, the home Sec name first
                List<ClassSection> ranked = candidates.stream()
                        .sorted(Comparator.comparing((ClassSection c) -> c.getApprovalStatus() != ApprovalStatus.APPROVED)
                                .thenComparing(c -> !c.getSectionNo().equalsIgnoreCase(group))
                                .thenComparing(ClassSection::getSectionNo))
                        .toList();
                for (ClassSection candidate : ranked) {
                    List<String> found = sectionProblems(candidate, code, existing, picked);
                    if (s == null || found.isEmpty()) {
                        s = candidate;
                        sectionProblems = found;
                    }
                    if (found.isEmpty()) break;
                }
            }
            problems.addAll(sectionProblems);

            // Academic Prerequisite Validation
            if (s.getPrerequisiteCourseCodes() != null && !s.getPrerequisiteCourseCodes().trim().isEmpty()) {
                String[] reqCodes = s.getPrerequisiteCourseCodes().split("[,;\\s]+");
                List<String> missing = new ArrayList<>();
                List<CourseGrade> grades = courseGradeRepository != null
                        ? courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId)
                        : List.of();

                for (String rc : reqCodes) {
                    String clean = rc.trim().toUpperCase();
                    if (clean.isEmpty()) continue;
                    boolean passed = grades.stream().anyMatch(g ->
                            g.getCourseCode() != null
                            && g.getCourseCode().trim().equalsIgnoreCase(clean)
                            && g.getGrade() != null
                            && !g.getGrade().trim().isEmpty()
                            && !NON_PASSING_GRADES.contains(g.getGrade().trim().toUpperCase())
                    );
                    if (!passed) {
                        missing.add(clean);
                    }
                }
                if (!missing.isEmpty()) {
                    problems.add("ไม่ผ่านวิชาบังคับก่อน: " + String.join(", ", missing));
                }
            }

            picked.add(s);
            items.add(new CartItem(code, toView(s), seatsLeft(s), problems, choices));
        }

        int credits = picked.stream().mapToInt(ClassSection::getCredits).sum();
        boolean ok = !items.isEmpty() && items.stream().allMatch(i -> i.problems().isEmpty());
        return new RegistrationCheck(group, year, term, items, credits, ok);
    }

    /** Why one section of a course cannot go into the cart: not approved, time clashes or no seats left */
    private List<String> sectionProblems(ClassSection s, String code, List<ClassSection> existing, List<ClassSection> picked) {
        List<String> problems = new ArrayList<>();
        if (s.getApprovalStatus() != ApprovalStatus.APPROVED) {
            problems.add("กลุ่มเรียนนี้ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ");
        }
        existing.stream().filter(o -> !o.getCourseCode().equalsIgnoreCase(code) && overlaps(s, o)).forEach(o ->
                problems.add("เวลาเรียนชนกับ " + o.getCourseCode() + " " + o.getCourseName() + " (" + timeOf(o) + ")"));
        picked.stream().filter(o -> overlaps(s, o)).forEach(o ->
                problems.add("เวลาเรียนชนกับ " + o.getCourseCode() + " ที่เลือกไว้ในรายการ (" + timeOf(o) + ")"));
        Long left = seatsLeft(s);
        if (left != null && left == 0) {
            problems.add("ที่นั่งเต็มแล้ว");
        }
        return problems;
    }

    private Long seatsLeft(ClassSection s) {
        return s.getCapacity() == null ? null
                : Math.max(0, s.getCapacity() - enrollmentRepository.countBySectionIdAndStatusIn(s.getId(), ACTIVE));
    }

    /**
     * Sends the whole cart at once. Nothing is saved unless every course passes the check.
     * Every registration is confirmed straight away; there is no admin approval step.
     */
    @Transactional
    public RegistrationCheck submitRegistration(Actor actor, String studentId, RegistrationCartRequest req) {
        RegistrationCheck check = checkRegistration(actor, studentId, req);
        if (actor.kind() == Actor.Kind.STUDENT) {
            requireRegistrationOpen(check.academicYear(), check.term());
        }
        if (check.items().isEmpty()) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาเลือกวิชาอย่างน้อย 1 วิชา");
        }
        if (!check.ok()) {
            String firstPrereqProblem = check.items().stream()
                    .filter(i -> i.problems() != null)
                    .flatMap(i -> i.problems().stream())
                    .filter(p -> p.startsWith("ไม่ผ่านวิชาบังคับก่อน"))
                    .findFirst()
                    .orElse(null);
            String errorMsg = firstPrereqProblem != null ? firstPrereqProblem : "ยังลงทะเบียนไม่ได้ กรุณาแก้รายการที่มีปัญหาก่อน";
            throw new TimetableException(HttpStatus.CONFLICT, errorMsg, check);
        }
        Student student = findStudent(studentId);
        EnrollmentStatus status = EnrollmentStatus.CONFIRMED;
        for (CartItem item : check.items()) {
            ClassSection section = findSection(item.section().sectionId());
            if (actor.kind() == Actor.Kind.ADVISOR) requireCanManage(actor, section);
            // A rejected request for the same section is replaced by the new one
            enrollmentRepository.findByStudentStudentIdAndSectionId(studentId, section.getId())
                    .ifPresent(enrollmentRepository::delete);
            enrollmentRepository.flush();
            enrollmentRepository.save(new SectionEnrollment(null, student, section, LocalDateTime.now(), status, null));
        }
        return check;
    }

    /** Single course by code (kept for the API); goes through the same checks as the cart */
    @Transactional
    public SessionView enroll(Actor actor, String studentId, EnrollmentRequest req) {
        Map<String, String> sections = null;
        if (req.getSectionId() != null) {
            ClassSection s = findSection(req.getSectionId());
            sections = Map.of(s.getCourseCode(), s.getSectionNo());
            req.setCourseCode(s.getCourseCode());
            req.setAcademicYear(s.getAcademicYear());
            req.setTerm(s.getTerm());
        }
        if (req.getAcademicYear() == null || req.getTerm() == null) {
            LocalDateTime now = LocalDateTime.now();
            RegistrationPeriod open = periodRepository.findAll().stream().filter(p -> p.isOpenAt(now)).findFirst()
                    .orElseThrow(() -> new TimetableException(HttpStatus.FORBIDDEN, "ขณะนี้ปิดการลงทะเบียน ยังเพิ่มหรือลบวิชาไม่ได้"));
            req.setAcademicYear(open.getAcademicYear());
            req.setTerm(open.getTerm());
        }
        RegistrationCheck done = submitRegistration(actor, studentId,
                new RegistrationCartRequest(req.getAcademicYear(), req.getTerm(),
                        List.of(req.getCourseCode() == null ? "" : req.getCourseCode()), sections));
        return done.items().get(0).section();
    }

    @Transactional
    public SessionView drop(Actor actor, String studentId, Long sectionId) {
        SectionEnrollment enrollment = enrollmentRepository.findByStudentStudentIdAndSectionId(studentId, sectionId)
                .orElseThrow(() -> new TimetableException(HttpStatus.NOT_FOUND, "นักศึกษาไม่ได้ลงทะเบียน section นี้"));
        ClassSection section = enrollment.getSection();
        switch (actor.kind()) {
            case STUDENT -> {
                requireSelf(actor, studentId);
                // Dismissing a rejected request is always allowed
                if (enrollment.getStatus() != EnrollmentStatus.REJECTED) {
                    requireRegistrationOpen(section.getAcademicYear(), section.getTerm());
                }
            }
            case ADVISOR -> requireCanManage(actor, section);
            case ADMIN -> { }
        }
        enrollmentRepository.delete(enrollment);
        return toView(section);
    }

    // ------------------------------------------------------------------ student self-registration

    /**
     * Courses recorded in earlier semesters (or by other students) that match what the student is typing,
     * by code prefix or part of the name; one entry per course code, from its latest semester.
     */
    @Transactional(readOnly = true)
    public List<CourseSuggestion> courseSuggestions(String query) {
        String q = query == null ? "" : query.trim().toLowerCase();
        if (q.isEmpty()) return List.of();
        Map<String, ClassSection> latest = new LinkedHashMap<>();
        for (ClassSection s : sectionRepository.findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc()) {
            boolean match = s.getCourseCode().toLowerCase().startsWith(q)
                    || (s.getCourseName() != null && s.getCourseName().toLowerCase().contains(q));
            if (match) latest.putIfAbsent(s.getCourseCode().toUpperCase(), s);
            if (latest.size() >= 10) break;
        }
        return latest.values().stream().map(s -> new CourseSuggestion(s.getCourseCode(), s.getCourseName(),
                s.getCredits(), s.getInstructor() == null ? null : s.getInstructor().getId(), teacherName(s),
                s.getRoom(), s.getDayOfWeek(), s.getStartTime().format(HH_MM), s.getEndTime().format(HH_MM),
                termKey(s))).toList();
    }

    /** Sections of one course already recorded in a semester, so the form can warn before saving a duplicate */
    @Transactional(readOnly = true)
    public List<SessionView> sectionsOfCourse(int academicYear, int term, String courseCode) {
        if (isBlank(courseCode)) return List.of();
        return sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(
                academicYear, term, courseCode.trim()).stream().map(this::toView).toList();
    }

    /**
     * A student types in a course and is registered straight away (no approval). A new course is saved
     * as a section for later students to reuse; a course + Sec that already exists in the semester is
     * refused with 409 (details = the existing section) unless the student chose to join it.
     */
    @Transactional
    public SessionView selfRegister(Actor actor, String studentId, SelfRegistrationRequest req) {
        if (actor.kind() == Actor.Kind.ADVISOR) {
            throw new TimetableException(HttpStatus.FORBIDDEN, "เฉพาะนักศึกษาหรือผู้ดูแลระบบเท่านั้นที่ลงทะเบียนได้");
        }
        requireStudentAccess(actor, studentId);
        Student student = findStudent(studentId);

        if (req.getAcademicYear() == null || req.getTerm() == null) {
            LocalDateTime now = LocalDateTime.now();
            RegistrationPeriod open = periodRepository.findAll().stream().filter(p -> p.isOpenAt(now)).findFirst()
                    .orElseThrow(() -> new TimetableException(HttpStatus.FORBIDDEN, "ขณะนี้ปิดการลงทะเบียน"));
            req.setAcademicYear(open.getAcademicYear());
            req.setTerm(open.getTerm());
        }
        if (actor.kind() == Actor.Kind.STUDENT) requireRegistrationOpen(req.getAcademicYear(), req.getTerm());
        if (isBlank(req.getCourseCode())) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณากรอกรหัสวิชา");
        }
        String code = req.getCourseCode().trim().toUpperCase();
        requireValidCourseCode(code);
        String sectionNo = !isBlank(req.getSectionNo()) ? req.getSectionNo().trim().toUpperCase()
                : !isBlank(student.getStudentSection()) ? student.getStudentSection() : STUDENT_GROUPS.get(0);

        Optional<ClassSection> existing = sectionRepository
                .findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(req.getAcademicYear(), req.getTerm(), code)
                .stream().filter(s -> s.getSectionNo().equalsIgnoreCase(sectionNo)).findFirst();
        if (existing.isPresent()) {
            if (!req.isUseExisting()) {
                throw new TimetableException(HttpStatus.CONFLICT, "มีวิชา " + code + " Sec " + sectionNo + " ในภาคเรียน "
                        + req.getTerm() + "/" + req.getAcademicYear() + " อยู่ในระบบแล้ว", toView(existing.get()));
            }
            // Same checks as the cart: already registered, time clash, seats, prerequisites
            RegistrationCheck done = submitRegistration(actor, studentId, new RegistrationCartRequest(
                    req.getAcademicYear(), req.getTerm(), List.of(code), Map.of(code, sectionNo)));
            return done.items().get(0).section();
        }

        if (enrolledSections(studentId, req.getAcademicYear(), req.getTerm()).stream()
                .anyMatch(o -> o.getCourseCode().equalsIgnoreCase(code))) {
            throw new TimetableException(HttpStatus.CONFLICT, "ลงทะเบียนวิชา " + code + " ในภาคเรียนนี้ไว้แล้ว");
        }

        ClassSection s = new ClassSection();
        s.setSectionNo(sectionNo);
        SectionRequest sectionReq = new SectionRequest(req.getAcademicYear(), req.getTerm(), code, req.getCourseName(),
                req.getCredits(), sectionNo, req.getDayOfWeek(), req.getStartTime(), req.getEndTime(), req.getRoom(),
                isBlank(req.getInstructorId()) ? null : req.getInstructorId(), null, req.getInstructorName());
        applyRequest(s, sectionReq, true);
        if (s.getInstructor() == null && isBlank(s.getInstructorName())) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาเลือกหรือพิมพ์ชื่ออาจารย์ผู้สอน");
        }
        enrolledSections(studentId, s.getAcademicYear(), s.getTerm()).stream().filter(o -> overlaps(s, o)).findFirst()
                .ifPresent(o -> {
                    throw new TimetableException(HttpStatus.CONFLICT, "เวลาเรียนชนกับ " + o.getCourseCode() + " "
                            + o.getCourseName() + " (" + timeOf(o) + ")");
                });
        s.setApprovalStatus(ApprovalStatus.APPROVED);
        s.setRecordedBy(actor.id());
        s.setRecordedAt(LocalDateTime.now());
        ClassSection saved = sectionRepository.save(s);
        enrollmentRepository.save(new SectionEnrollment(null, student, saved, LocalDateTime.now(),
                EnrollmentStatus.CONFIRMED, null));
        return toView(saved, EnrollmentStatus.CONFIRMED);
    }

    // ------------------------------------------------------------------ registration log (admin)

    /** Every registration, newest first; optionally only one semester */
    @Transactional(readOnly = true)
    public List<RegistrationRecord> registrationLog(Actor actor, Integer academicYear, Integer term) {
        requireAdmin(actor, "เฉพาะผู้ดูแลระบบเท่านั้นที่ดูบันทึกการลงทะเบียนได้");
        return enrollmentRepository.findAll().stream()
                .filter(e -> e.getStatus() != EnrollmentStatus.REJECTED)
                .filter(e -> academicYear == null || e.getSection().getAcademicYear().equals(academicYear))
                .filter(e -> term == null || e.getSection().getTerm().equals(term))
                .sorted(Comparator.comparing(SectionEnrollment::getEnrolledAt).reversed())
                .map(e -> new RegistrationRecord(e.getId(), e.getStudent().getStudentId(), e.getStudent().getNameTh(),
                        e.getStudent().getStudentSection(), toView(e.getSection()), e.getStatus(), e.getEnrolledAt()))
                .toList();
    }

    /** Admin moves a student to Sec D1 or D2 */
    @Transactional
    public Map<String, String> setStudentSection(Actor actor, String studentId, String group) {
        requireAdmin(actor, "เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนด Sec ของนักศึกษาได้");
        String normalized = group == null ? "" : group.trim().toUpperCase();
        if (!STUDENT_GROUPS.contains(normalized)) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "Sec ต้องเป็น " + String.join(" หรือ ", STUDENT_GROUPS));
        }
        Student student = findStudent(studentId);
        student.setStudentSection(normalized);
        studentRepository.save(student);
        return Map.of("studentId", studentId, "studentSection", normalized);
    }

    // ------------------------------------------------------------------ sections (admin / teacher)

    @Transactional
    public SessionView createSection(Actor actor, SectionRequest req) {
        if (actor.kind() == Actor.Kind.STUDENT) {
            throw new TimetableException(HttpStatus.FORBIDDEN, "นักศึกษาสร้างรายวิชาไม่ได้");
        }
        ClassSection s = new ClassSection();
        s.setSectionNo(STUDENT_GROUPS.get(0));
        applyRequest(s, req, true);
        if (actor.kind() == Actor.Kind.ADVISOR) {
            // Teachers always create sections they teach themselves
            s.setInstructor(findAdvisor(actor.id()));
            s.setInstructorName(null);
        }
        s.setApprovalStatus(ApprovalStatus.APPROVED);
        s.setRecordedBy(actor.id());
        s.setRecordedAt(LocalDateTime.now());
        requireUniqueSection(s);
        requireNoTimeClash(s);
        return toView(sectionRepository.save(s));
    }

    /**
     * A teacher opens a course with one or both Secs (D1, D2) in one go.
     * All-or-nothing: if any Sec fails (time clash, room taken, bad data) none is created.
     */
    @Transactional
    public List<SessionView> createSections(Actor actor, List<SectionRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาเลือกอย่างน้อย 1 Sec");
        }
        List<SessionView> created = new ArrayList<>();
        for (SectionRequest req : requests) {
            created.add(createSection(actor, req));
            sectionRepository.flush();
        }
        return created;
    }

    @Transactional
    public SessionView updateSection(Actor actor, Long sectionId, SectionRequest req) {
        ClassSection s = findSection(sectionId);
        requireCanManage(actor, s);
        applyRequest(s, req, false);
        if (actor.kind() == Actor.Kind.ADVISOR) {
            s.setInstructor(findAdvisor(actor.id()));
            s.setInstructorName(null);
        }
        requireUniqueSection(s);
        requireNoTimeClash(s);
        return toView(sectionRepository.save(s));
    }

    @Transactional
    public void deleteSection(Actor actor, Long sectionId) {
        ClassSection s = findSection(sectionId);
        requireCanManage(actor, s);
        if (actor.kind() == Actor.Kind.ADVISOR && enrollmentRepository.countBySectionIdAndStatusIn(sectionId, ACTIVE) > 0) {
            throw new TimetableException(HttpStatus.CONFLICT,
                    "กลุ่มเรียนนี้มีนักศึกษาลงทะเบียนแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อปิดกลุ่มเรียน");
        }
        enrollmentRepository.deleteBySectionId(sectionId);
        if (instructorGradeRepository != null) instructorGradeRepository.deleteBySectionId(sectionId);
        if (gradeSubmissionRepository != null)
            gradeSubmissionRepository.findById(sectionId).ifPresent(gradeSubmissionRepository::delete);
        sectionRepository.delete(s);
    }

    // ------------------------------------------------------------------ registration periods (admin)

    @Transactional
    public RegistrationStatus savePeriod(Actor actor, RegistrationPeriodRequest req) {
        requireAdmin(actor, "เฉพาะผู้ดูแลระบบเท่านั้นที่เปิด/ปิดการลงทะเบียนได้");
        if (req.getAcademicYear() == null || req.getTerm() == null) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาระบุปีการศึกษาและภาคเรียน");
        }
        RegistrationPeriod p = periodRepository.findByAcademicYearAndTerm(req.getAcademicYear(), req.getTerm())
                .orElseGet(() -> {
                    RegistrationPeriod created = new RegistrationPeriod();
                    created.setAcademicYear(req.getAcademicYear());
                    created.setTerm(req.getTerm());
                    return created;
                });
        if (req.getOpensAt() != null) p.setOpensAt(parseDateTime(req.getOpensAt(), "opensAt"));
        if (req.getClosesAt() != null) p.setClosesAt(parseDateTime(req.getClosesAt(), "closesAt"));
        if (req.getForceClosed() != null) p.setForceClosed(req.getForceClosed());
        if (p.getOpensAt() == null || p.getClosesAt() == null) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "กรุณาระบุวันเวลาเปิดและปิดการลงทะเบียน");
        }
        if (!p.getOpensAt().isBefore(p.getClosesAt())) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "วันเวลาปิดต้องอยู่หลังวันเวลาเปิด");
        }
        return toStatus(periodRepository.save(p), LocalDateTime.now());
    }

    // ------------------------------------------------------------------ helpers

    private void requireAdmin(Actor actor, String message) {
        if (actor.kind() != Actor.Kind.ADMIN) {
            throw new TimetableException(HttpStatus.FORBIDDEN, message);
        }
    }

    private void requireSelf(Actor actor, String studentId) {
        if (!studentId.equals(actor.id())) {
            throw new TimetableException(HttpStatus.FORBIDDEN, "นักศึกษาแก้ไขได้เฉพาะตารางเรียนของตนเอง");
        }
    }

    private void requireStudentAccess(Actor actor, String studentId) {
        if (actor.kind() == Actor.Kind.STUDENT) requireSelf(actor, studentId);
    }

    private void requireRegistrationOpen(int academicYear, int term) {
        Optional<RegistrationPeriod> period = periodRepository.findByAcademicYearAndTerm(academicYear, term);
        if (period.isEmpty() || !period.get().isOpenAt(LocalDateTime.now())) {
            throw new TimetableException(HttpStatus.FORBIDDEN,
                    "ขณะนี้ปิดการลงทะเบียนภาคเรียน " + term + "/" + academicYear + " ยังเพิ่มหรือลบวิชาไม่ได้");
        }
    }

    private void requireCanManage(Actor actor, ClassSection section) {
        if (actor.kind() == Actor.Kind.ADMIN) return;
        boolean ownSection = actor.kind() == Actor.Kind.ADVISOR && section.getInstructor() != null
                && section.getInstructor().getId().equals(actor.id());
        if (!ownSection) {
            throw new TimetableException(HttpStatus.FORBIDDEN, "แก้ไขได้เฉพาะรายวิชาที่ตนเองสอน");
        }
    }

    private void requireUniqueSection(ClassSection s) {
        boolean duplicate = sectionRepository.findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(
                        s.getAcademicYear(), s.getTerm(), s.getCourseCode()).stream()
                .anyMatch(o -> !Objects.equals(o.getId(), s.getId()) && o.getSectionNo().equalsIgnoreCase(s.getSectionNo()));
        if (duplicate) {
            throw new TimetableException(HttpStatus.CONFLICT, "มีวิชา " + s.getCourseCode() + " Sec " + s.getSectionNo()
                    + " ในภาคเรียน " + s.getTerm() + "/" + s.getAcademicYear() + " อยู่แล้ว");
        }
    }

    /** A teacher cannot teach two classes at once, and a room cannot hold two classes at once (same semester) */
    private void requireNoTimeClash(ClassSection s) {
        List<ClassSection> sameTerm = sectionRepository
                .findByAcademicYearAndTermOrderByCourseCodeAscSectionNoAsc(s.getAcademicYear(), s.getTerm());
        for (ClassSection o : sameTerm) {
            if (Objects.equals(o.getId(), s.getId()) || !overlaps(s, o)) continue;
            boolean sameTeacher = s.getInstructor() != null && o.getInstructor() != null
                    && s.getInstructor().getId().equals(o.getInstructor().getId());
            if (sameTeacher) {
                throw new TimetableException(HttpStatus.CONFLICT, "เวลาสอนทับกับ " + o.getCourseCode() + " Sec " + o.getSectionNo()
                        + " (" + timeOf(o) + ") ของ " + o.getInstructor().getNameTh());
            }
            if (!isBlank(s.getRoom()) && s.getRoom().equalsIgnoreCase(o.getRoom())) {
                throw new TimetableException(HttpStatus.CONFLICT, "ห้อง " + s.getRoom() + " มีวิชา " + o.getCourseCode()
                        + " Sec " + o.getSectionNo() + " ใช้อยู่ (" + timeOf(o) + ")");
            }
        }
    }

    /** Copies the non-null fields of the request; on create every required field must be present. */
    private void applyRequest(ClassSection s, SectionRequest req, boolean creating) {
        if (req.getAcademicYear() != null) s.setAcademicYear(req.getAcademicYear());
        if (req.getTerm() != null) s.setTerm(req.getTerm());
        if (req.getCourseCode() != null) s.setCourseCode(req.getCourseCode().trim().toUpperCase());
        if (req.getCourseName() != null) s.setCourseName(req.getCourseName().trim());
        if (req.getCredits() != null) s.setCredits(req.getCredits());
        if (req.getSectionNo() != null && !req.getSectionNo().isBlank()) s.setSectionNo(req.getSectionNo().trim().toUpperCase());
        if (req.getDayOfWeek() != null) s.setDayOfWeek(req.getDayOfWeek());
        if (req.getStartTime() != null) s.setStartTime(parseTime(req.getStartTime(), "startTime"));
        if (req.getEndTime() != null) s.setEndTime(parseTime(req.getEndTime(), "endTime"));
        if (req.getRoom() != null) s.setRoom(req.getRoom().trim());
        if (req.getCapacity() != null) s.setCapacity(req.getCapacity());
        if (req.getInstructorId() != null) {
            s.setInstructor(req.getInstructorId().isBlank() ? null : findAdvisor(req.getInstructorId().trim()));
        }

        if (creating && (s.getAcademicYear() == null || s.getTerm() == null || isBlank(s.getCourseCode())
                || isBlank(s.getCourseName()) || s.getCredits() == null || s.getDayOfWeek() == null
                || s.getStartTime() == null || s.getEndTime() == null)) {
            throw new TimetableException(HttpStatus.BAD_REQUEST,
                    "ข้อมูลไม่ครบ ต้องมี academicYear, term, courseCode, courseName, credits, dayOfWeek, startTime, endTime");
        }
        if (req.getInstructorName() != null) s.setInstructorName(isBlank(req.getInstructorName()) ? null : req.getInstructorName().trim());
        if (s.getInstructor() != null) s.setInstructorName(null);

        // Seats are optional (null = unlimited); when set they are the hard limit for registration
        if (s.getCapacity() != null && s.getCapacity() <= 0) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "จำนวนที่นั่งต้องมากกว่า 0 (เว้นว่างได้ถ้าไม่จำกัด)");
        }
        if (s.getId() != null && s.getCapacity() != null) {
            long taken = enrollmentRepository.countBySectionIdAndStatusIn(s.getId(), ACTIVE);
            if (s.getCapacity() < taken) {
                throw new TimetableException(HttpStatus.BAD_REQUEST, "จำนวนที่นั่งต้องไม่น้อยกว่าจำนวนนักศึกษาที่ลงไว้แล้ว (" + taken + " คน)");
            }
        }
        if (!STUDENT_GROUPS.contains(s.getSectionNo())) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "Sec ต้องเป็น " + String.join(" หรือ ", STUDENT_GROUPS));
        }
        requireValidCourseCode(s.getCourseCode());
        if (s.getTerm() < 1 || s.getTerm() > 3) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "ภาคเรียนต้องเป็น 1, 2 หรือ 3");
        }
        if (s.getDayOfWeek() < 0 || s.getDayOfWeek() > 6) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "dayOfWeek ต้องเป็น 0 (จันทร์) ถึง 6 (อาทิตย์)");
        }
        if (s.getCredits() <= 0) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "หน่วยกิตต้องมากกว่า 0");
        }
        if (!s.getStartTime().isBefore(s.getEndTime())) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม");
        }
    }

    /** Sections a student holds (confirmed or waiting for the admin) in one semester */
    private List<ClassSection> enrolledSections(String studentId, int academicYear, int term) {
        return enrollmentRepository.findByStudentStudentId(studentId).stream()
                .filter(e -> ACTIVE.contains(e.getStatus()))
                .map(SectionEnrollment::getSection)
                .filter(s -> s.getAcademicYear() == academicYear && s.getTerm() == term)
                .toList();
    }

    private static boolean overlaps(ClassSection a, ClassSection b) {
        return a.getDayOfWeek().equals(b.getDayOfWeek())
                && a.getStartTime().isBefore(b.getEndTime()) && b.getStartTime().isBefore(a.getEndTime());
    }

    private static String timeOf(ClassSection s) {
        return "วัน" + DAY_NAMES_TH[s.getDayOfWeek()] + " " + s.getStartTime().format(HH_MM) + "-" + s.getEndTime().format(HH_MM);
    }

    private static String termKey(ClassSection s) {
        return s.getTerm() + "/" + s.getAcademicYear();
    }

    /** Clashes can still appear when a teacher moves a section after students enrolled */
    private static List<String> findConflicts(List<ClassSection> sections) {
        List<String> conflicts = new ArrayList<>();
        for (int i = 0; i < sections.size(); i++) {
            for (int j = i + 1; j < sections.size(); j++) {
                ClassSection a = sections.get(i);
                ClassSection b = sections.get(j);
                if (overlaps(a, b)) {
                    conflicts.add(String.format("%s ชนกับ %s วัน%s", a.getCourseCode(), b.getCourseCode(),
                            DAY_NAMES_TH[a.getDayOfWeek()]));
                }
            }
        }
        return conflicts;
    }

    private SessionView toView(ClassSection s) {
        return toView(s, null);
    }

    private SessionView toView(ClassSection s, EnrollmentStatus enrollmentStatus) {
        Advisor teacher = s.getInstructor();
        return new SessionView(s.getId(), s.getAcademicYear(), s.getTerm(), s.getCourseCode(), s.getCourseName(),
                s.getCredits(), s.getSectionNo(), s.getDayOfWeek(), DAY_NAMES_TH[s.getDayOfWeek()],
                s.getStartTime().format(HH_MM), s.getEndTime().format(HH_MM), s.getRoom(),
                teacher == null ? null : teacher.getId(),
                teacherName(s),
                teacher == null ? null : teacher.getEmail(),
                s.getCapacity(), enrollmentRepository.countBySectionIdAndStatusIn(s.getId(), ACTIVE),
                s.getApprovalStatus(), s.getReviewNote(), enrollmentStatus, s.getRecordedBy());
    }

    /** Course codes are English letters and digits only (stored upper-case), at most 20 characters */
    private static void requireValidCourseCode(String code) {
        if (code == null || !COURSE_CODE.matcher(code).matches()) {
            throw new TimetableException(HttpStatus.BAD_REQUEST,
                    "รหัสวิชาต้องเป็นภาษาอังกฤษหรือตัวเลขเท่านั้น (ไม่เกิน 20 ตัว ไม่มีช่องว่างหรือสัญลักษณ์) เช่น CS3101");
        }
    }

    /** The teacher in the system, else the name typed by hand */
    private static String teacherName(ClassSection s) {
        return s.getInstructor() != null ? s.getInstructor().getNameTh() : s.getInstructorName();
    }

    private static RegistrationStatus toStatus(RegistrationPeriod p, LocalDateTime now) {
        return new RegistrationStatus(p.getId(), p.getAcademicYear(), p.getTerm(), p.getOpensAt(), p.getClosesAt(),
                p.isForceClosed(), p.isOpenAt(now));
    }

    private ClassSection findSection(Long id) {
        return sectionRepository.findById(id)
                .orElseThrow(() -> new TimetableException(HttpStatus.NOT_FOUND, "ไม่พบ section id " + id));
    }

    private Student findStudent(String id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> new TimetableException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + id));
    }

    private Advisor findAdvisor(String id) {
        return advisorRepository.findById(id)
                .orElseThrow(() -> new TimetableException(HttpStatus.BAD_REQUEST, "ไม่พบอาจารย์รหัส " + id + " ในระบบ"));
    }

    private static LocalTime parseTime(String value, String field) {
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, field + " ต้องอยู่ในรูปแบบ HH:mm เช่น 09:00");
        }
    }

    private static LocalDateTime parseDateTime(String value, String field) {
        try {
            return LocalDateTime.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new TimetableException(HttpStatus.BAD_REQUEST, field + " ต้องอยู่ในรูปแบบ yyyy-MM-ddTHH:mm เช่น 2026-10-05T08:00");
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
