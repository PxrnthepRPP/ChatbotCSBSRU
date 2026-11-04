package com.bsru.studentportal.service;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AcademicRecordService.GradeReport;
import com.bsru.studentportal.service.GraduationAuditService.AuditResult;
import com.bsru.studentportal.service.GraduationAuditService.Unit;
import com.bsru.studentportal.service.TimetableService.TermTimetable;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Advisor view of their advisees: real records from the database plus a rule-based risk check
 * (retire / fail / drop) that both the advisor pages and the chatbot use, so they always agree.
 *
 * The thresholds below are the common Thai undergraduate rules and are only defaults;
 * change them here when the official BSRU regulation says otherwise.
 */
@Service
@RequiredArgsConstructor
public class AdvisorInsightService {

    // ---- Risk criteria (defaults) ----
    /** Cumulative GPA below this: at risk of being dismissed (รีไทร์ / พ้นสภาพ) */
    public static final double RETIRE_GPA = 1.50;
    /** Cumulative GPA below this: academic probation, cannot graduate */
    public static final double PROBATION_GPA = 2.00;
    /** Cumulative GPA below this: watch list */
    public static final double WATCH_GPA = 2.25;
    /** Latest semester GPA lower than the previous one by at least this much */
    public static final double TERM_DROP = 0.50;
    /** Number of F grades that makes failing a high risk */
    public static final int FAILS_HIGH = 2;
    /** Number of D / D+ grades that is a warning sign */
    public static final int LOW_GRADES_WARN = 3;
    /** Credits registered this semester considered heavy when the GPA is weak */
    public static final int HEAVY_LOAD_CREDITS = 21;
    public static final double HEAVY_LOAD_GPA = 2.50;
    /** Earned credits below this share of the study plan (credits per semester x semesters done) */
    public static final double PROGRESS_RATIO = 0.85;

    private static final Map<String, Double> GRADE_POINTS = Map.of(
            "A", 4.0, "B+", 3.5, "B", 3.0, "C+", 2.5, "C", 2.0, "D+", 1.5, "D", 1.0, "F", 0.0);

    public enum Level { HIGH, MEDIUM, LOW }

    /** category: RETIRE (พ้นสภาพ), FAIL (ตก), DROP (ถอน/ดรอปรายวิชา), PROGRESS (จบช้า), STATUS */
    public record RiskFactor(Level level, String category, String message, String suggestion) {}

    public record TermGpa(String term, double gpa, int credits) {}

    public record CourseResult(String code, String name, String grade, String term, int credits) {}

    public record AdviseeRisk(String studentId, String nameTh, String nameEn, Integer year, String status,
                              String studentSection, Double gpa, String gpaSource,
                              Integer earnedCredits, Integer requiredCredits, Integer expectedCredits,
                              List<TermGpa> terms, Map<String, Integer> gradeCounts,
                              List<CourseResult> failedCourses, List<CourseResult> lowGradeCourses,
                              String currentTerm, Integer currentCredits, List<String> conflicts,
                              Level level, boolean riskRetire, boolean riskFail, boolean riskDrop,
                              List<RiskFactor> factors, boolean simulated) {}

    public record AdviseeDetail(AdviseeRisk risk, Student profile, List<CourseResult> courses,
                                JsonNode auditSummary, List<Unit> auditUnits,
                                List<TermTimetable> timetable, List<AcademicPetition> petitions) {}

    public static String criteriaText() {
        return String.format(Locale.ROOT, """
                เกณฑ์ความเสี่ยงที่ระบบใช้ (ค่าเริ่มต้นตามระเบียบทั่วไปของมหาวิทยาลัยไทย):
                - เสี่ยงพ้นสภาพ/รีไทร์ (สูง): GPA สะสม < %.2f
                - วิทยาทัณฑ์ (สูง): GPA สะสม < %.2f (ต่ำกว่าเกณฑ์จบ)
                - เฝ้าระวัง (ปานกลาง): GPA สะสม < %.2f
                - เสี่ยงตก: ได้ F ตั้งแต่ %d วิชา (สูง) หรือ 1 วิชา (ปานกลาง), ได้ D/D+ ตั้งแต่ %d วิชา (ปานกลาง), GPA เทอมล่าสุด < 2.00 หรือลดลง ≥ %.2f จากเทอมก่อน
                - เสี่ยงต้องถอน/ดรอปรายวิชา: ลงทะเบียนเทอมปัจจุบัน ≥ %d หน่วยกิตขณะ GPA < %.2f หรือมีวิชาเวลาเรียนชนกัน
                - จบช้ากว่าแผน: หน่วยกิตที่ได้ < %.0f%% ของแผน (หน่วยกิตหลักสูตร ÷ 8 เทอม × จำนวนเทอมที่เรียนแล้ว)
                """, RETIRE_GPA, PROBATION_GPA, WATCH_GPA, FAILS_HIGH, LOW_GRADES_WARN, TERM_DROP,
                HEAVY_LOAD_CREDITS, HEAVY_LOAD_GPA, PROGRESS_RATIO * 100);
    }

    private final StudentRepository studentRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final GraduationAuditService graduationAudits;
    private final AcademicRecordService academicRecords;
    private final TimetableService timetableService;

    @Transactional(readOnly = true)
    public List<Student> adviseesOf(String advisorId) {
        return studentRepository.findAll().stream()
                .filter(s -> s.getAdvisor() != null && advisorId.equals(s.getAdvisor().getId()))
                .sorted(Comparator.comparing(Student::getStudentId))
                .toList();
    }

    /** All advisees with their risk, most at-risk first */
    @Transactional(readOnly = true)
    public List<AdviseeRisk> risksOf(String advisorId) {
        return adviseesOf(advisorId).stream()
                .map(this::riskOf)
                .sorted(Comparator.comparing(AdviseeRisk::level)
                        .thenComparing(r -> r.gpa() == null ? 99 : r.gpa()))
                .toList();
    }

    /** Every real (not simulated) student, for the demo advisor login that may see everyone */
    @Transactional(readOnly = true)
    public List<Student> allRealStudents() {
        return studentRepository.findAll().stream()
                .filter(s -> !s.isSimulated())
                .sorted(Comparator.comparing(Student::getStudentId))
                .toList();
    }

    /** Risk of every real student, most at-risk first (demo advisor login) */
    @Transactional(readOnly = true)
    public List<AdviseeRisk> risksOfAllReal() {
        return allRealStudents().stream()
                .map(this::riskOf)
                .sorted(Comparator.comparing(AdviseeRisk::level)
                        .thenComparing(r -> r.gpa() == null ? 99 : r.gpa()))
                .toList();
    }

    /** Detail of any student, without the advisor check (demo advisor login) */
    @Transactional(readOnly = true)
    public Optional<AdviseeDetail> detailOfAny(String studentId) {
        return studentRepository.findById(studentId).map(this::detail);
    }

    /** Detail of one advisee; empty when the student is not advised by this advisor */
    @Transactional(readOnly = true)
    public Optional<AdviseeDetail> detailOf(String advisorId, String studentId) {
        return studentRepository.findById(studentId)
                .filter(s -> s.getAdvisor() != null && advisorId.equals(s.getAdvisor().getId()))
                .map(this::detail);
    }

    private AdviseeDetail detail(Student s) {
        Optional<AuditResult> audit = graduationAudits.auditOf(s.getStudentId());
        return new AdviseeDetail(riskOf(s), s, coursesOf(s, audit),
                audit.map(a -> a.audit().get("summary")).orElse(null),
                audit.map(AuditResult::units).orElse(List.of()),
                timetableService.timetableOf(s.getStudentId()),
                petitionRepository.findByStudentStudentId(s.getStudentId()));
    }

    @Transactional(readOnly = true)
    public AdviseeRisk riskOf(Student s) {
        Optional<AuditResult> audit = graduationAudits.auditOf(s.getStudentId());
        List<CourseResult> courses = coursesOf(s, audit);

        // GPA: the graduation audit covers every course; otherwise the grades table; otherwise the profile
        Double gpa;
        String gpaSource;
        Integer earned = null;
        Integer required = null;
        if (audit.isPresent()) {
            JsonNode summary = audit.get().audit().get("summary");
            // Same as the grades page: the audit plus teacher grades the admin has released
            Double withReleased = academicRecords.gradesOf(s.getStudentId()).gpa();
            gpa = withReleased != null ? withReleased : summary.path("currentGpa").asDouble();
            gpaSource = "ใบตรวจสอบจบ";
            earned = summary.path("totalEarnedCredits").asInt();
            required = summary.path("totalRequiredCredits").asInt();
        } else {
            GradeReport grades = academicRecords.gradesOf(s.getStudentId());
            if (grades.gpa() != null) {
                gpa = grades.gpa();
                gpaSource = "ผลการเรียน";
            } else {
                // GPA 0.00 with no grades at all means "no results yet" (e.g. a new student), not a failing GPA
                boolean noResults = s.getGpa() == null || s.getGpa() == 0.0;
                gpa = noResults ? null : s.getGpa();
                gpaSource = noResults ? "ยังไม่มีผลการเรียน" : "ประวัตินักศึกษา";
            }
        }

        List<TermGpa> terms = termGpas(courses);
        Map<String, Integer> gradeCounts = new LinkedHashMap<>();
        for (String g : List.of("A", "B+", "B", "C+", "C", "D+", "D", "F")) gradeCounts.put(g, 0);
        courses.forEach(c -> gradeCounts.computeIfPresent(c.grade(), (k, v) -> v + 1));
        List<CourseResult> failed = courses.stream().filter(c -> "F".equals(c.grade())).toList();
        List<CourseResult> low = courses.stream().filter(c -> "D".equals(c.grade()) || "D+".equals(c.grade())).toList();

        // Current semester = the one with a registration period (the semester being registered / studied),
        // else the newest semester in the timetable
        List<TermTimetable> timetable = timetableService.timetableOf(s.getStudentId());
        TermTimetable current = timetable.stream().filter(t -> t.registration() != null).findFirst()
                .orElse(timetable.isEmpty() ? null : timetable.get(0));
        Integer expected = required == null ? null : (int) Math.round(required / 8.0 * terms.size());

        List<RiskFactor> factors = new ArrayList<>();
        if ("พ้นสภาพ".equals(s.getStatus())) {
            factors.add(new RiskFactor(Level.HIGH, "STATUS", "สถานะในระบบเป็น พ้นสภาพ แล้ว", "ตรวจสอบสถานะกับสำนักทะเบียน และแนะนำช่องทางคืนสภาพ (ถ้ามี)"));
        } else if ("พักการศึกษา".equals(s.getStatus())) {
            factors.add(new RiskFactor(Level.MEDIUM, "STATUS", "กำลังพักการศึกษา", "ติดตามกำหนดกลับมาเรียนและการรักษาสภาพ"));
        }
        if (gpa != null) {
            if (gpa < RETIRE_GPA) {
                factors.add(new RiskFactor(Level.HIGH, "RETIRE", fmt("GPA สะสม %.2f ต่ำกว่า %.2f เสี่ยงพ้นสภาพ (รีไทร์)", gpa, RETIRE_GPA),
                        "นัดพบโดยด่วน วางแผนลงเรียนซ้ำวิชาที่ได้ F/D เพื่อดึงเกรด และลดหน่วยกิตเทอมถัดไป"));
            } else if (gpa < PROBATION_GPA) {
                factors.add(new RiskFactor(Level.HIGH, "RETIRE", fmt("GPA สะสม %.2f ต่ำกว่า %.2f (วิทยาทัณฑ์ และยังจบไม่ได้)", gpa, PROBATION_GPA),
                        "ตั้งเป้า GPA เทอมหน้า ≥ 2.50 ลงเรียนซ้ำวิชาที่ได้ F/D และติดตามผลทุกกลางภาค"));
            } else if (gpa < WATCH_GPA) {
                factors.add(new RiskFactor(Level.MEDIUM, "RETIRE", fmt("GPA สะสม %.2f ใกล้เกณฑ์ขั้นต่ำ %.2f", gpa, PROBATION_GPA),
                        "เลี่ยงการลงหน่วยกิตหนัก เลือกวิชาที่ถนัดเพื่อรักษา GPA"));
            }
        }
        if (failed.size() >= FAILS_HIGH) {
            factors.add(new RiskFactor(Level.HIGH, "FAIL", "ได้ F " + failed.size() + " วิชา: " + codes(failed),
                    "ต้องลงเรียนซ้ำ ตรวจว่าเป็นวิชาบังคับ/วิชาที่เป็นพื้นฐานของวิชาต่อไปหรือไม่"));
        } else if (failed.size() == 1) {
            factors.add(new RiskFactor(Level.MEDIUM, "FAIL", "ได้ F 1 วิชา: " + codes(failed), "วางแผนลงเรียนซ้ำในเทอมที่เปิดสอน"));
        }
        if (low.size() >= LOW_GRADES_WARN) {
            factors.add(new RiskFactor(Level.MEDIUM, "FAIL", "ได้ D/D+ " + low.size() + " วิชา: " + codes(low),
                    "ทบทวนพื้นฐานในวิชาที่ต่อเนื่องกัน มีโอกาสตกในวิชาระดับสูงขึ้น"));
        }
        if (!terms.isEmpty()) {
            TermGpa last = terms.get(terms.size() - 1);
            if (last.gpa() < PROBATION_GPA) {
                factors.add(new RiskFactor(Level.MEDIUM, "FAIL", fmt("GPA เทอมล่าสุด (%s) %.2f ต่ำกว่า 2.00", last.term(), last.gpa()),
                        "พูดคุยหาสาเหตุ (เวลาเรียน งานพิเศษ ปัญหาส่วนตัว) และติดตามใกล้ชิด"));
            }
            if (terms.size() >= 2) {
                TermGpa prev = terms.get(terms.size() - 2);
                if (prev.gpa() - last.gpa() >= TERM_DROP) {
                    factors.add(new RiskFactor(Level.MEDIUM, "FAIL", fmt("GPA ลดลงจาก %.2f (%s) เป็น %.2f (%s)", prev.gpa(), prev.term(), last.gpa(), last.term()),
                            "ผลการเรียนมีแนวโน้มลดลง ควรติดตามก่อนสอบกลางภาค"));
                }
            }
        }
        if (current != null) {
            if (current.totalCredits() >= HEAVY_LOAD_CREDITS && gpa != null && gpa < HEAVY_LOAD_GPA) {
                factors.add(new RiskFactor(Level.MEDIUM, "DROP", fmt("ลงทะเบียน %s ไว้ %d หน่วยกิต ขณะ GPA %.2f", current.label(), current.totalCredits(), gpa),
                        "เสี่ยงต้องถอนรายวิชา (W) แนะนำลดเหลือ 15–18 หน่วยกิต ถอนวิชาที่ไม่บังคับก่อนหมดเขตถอน"));
            }
            if (!current.conflicts().isEmpty()) {
                factors.add(new RiskFactor(Level.MEDIUM, "DROP", "เวลาเรียนชนกัน (" + current.label() + "): " + String.join(", ", current.conflicts()),
                        "ต้องถอนหรือเปลี่ยน Sec วิชาใดวิชาหนึ่ง ไม่เช่นนั้นจะขาดเรียน/ขาดสอบ"));
            }
        }
        if (earned != null && expected != null && expected > 0 && earned < expected * PROGRESS_RATIO) {
            factors.add(new RiskFactor(Level.MEDIUM, "PROGRESS", "หน่วยกิตที่ได้ " + earned + " ต่ำกว่าแผน (ควรมีประมาณ " + expected + ")",
                    "จบช้ากว่ากำหนด วางแผนลงภาคฤดูร้อนหรือเพิ่มหน่วยกิตเมื่อ GPA ดีขึ้น"));
        }

        Level level = factors.stream().map(RiskFactor::level).min(Comparator.naturalOrder()).orElse(Level.LOW);
        boolean retire = factors.stream().anyMatch(f -> "RETIRE".equals(f.category()) && f.level() == Level.HIGH)
                || "พ้นสภาพ".equals(s.getStatus());
        boolean fail = factors.stream().anyMatch(f -> "FAIL".equals(f.category()));
        boolean drop = factors.stream().anyMatch(f -> "DROP".equals(f.category()));
        return new AdviseeRisk(s.getStudentId(), s.getNameTh(), s.getNameEn(), s.getYear(), s.getStatus(),
                s.getStudentSection(), gpa == null ? null : Math.round(gpa * 100) / 100.0, gpaSource,
                earned, required, expected, terms, gradeCounts, failed, low,
                current == null ? null : current.label(), current == null ? null : current.totalCredits(),
                current == null ? List.of() : current.conflicts(), level, retire, fail, drop, factors, s.isSimulated());
    }

    /** Every graded course: from the graduation audit if there is one, else from the grades table */
    private List<CourseResult> coursesOf(Student s, Optional<AuditResult> audit) {
        List<CourseResult> result = new ArrayList<>();
        if (audit.isPresent()) {
            collect(audit.get().audit().path("sections"), result);
            // Teacher grades released by the admin replace the same course in the same term
            academicRecords.releasedGradesOf(s.getStudentId()).forEach(g -> {
                String term = g.term() + "/" + (g.academicYear() % 100);
                result.removeIf(c -> c.code().equalsIgnoreCase(g.courseCode()) && term.equals(c.term()));
                result.add(new CourseResult(g.courseCode(), g.courseName(), g.grade(), term, g.credits()));
            });
            return result;
        }
        academicRecords.gradesOf(s.getStudentId()).semesters().forEach(sem -> sem.courses().forEach(c -> {
            if (c.grade() != null && GRADE_POINTS.containsKey(c.grade())) {
                result.add(new CourseResult(c.code(), c.name(), c.grade(), sem.term() + "/" + (sem.academicYear() % 100), c.credits()));
            }
        }));
        return result;
    }

    private static void collect(JsonNode nodes, List<CourseResult> out) {
        for (JsonNode n : nodes) {
            for (JsonNode c : n.path("courses")) {
                c.path("terms").fields().forEachRemaining(e -> {
                    String[] parts = e.getValue().asText().trim().split("\\s+");
                    if (parts.length < 2 || !GRADE_POINTS.containsKey(parts[0])) return;
                    int credits = c.path("ca").asInt(0) > 0 ? c.path("ca").asInt() : c.path("attempted").asInt(0);
                    if (credits <= 0) credits = parseCredits(c.path("credits").asText());
                    out.add(new CourseResult(c.path("code").asText(), c.path("name").asText(), parts[0], parts[1], credits));
                });
            }
            collect(n.path("groups"), out);
            collect(n.path("subsections"), out);
        }
    }

    /** Semester GPAs, oldest first; term labels are "semester/yy" */
    private static List<TermGpa> termGpas(List<CourseResult> courses) {
        Map<Integer, List<CourseResult>> byTerm = new TreeMap<>();
        for (CourseResult c : courses) {
            String[] t = c.term().split("/");
            if (t.length != 2) continue;
            try {
                byTerm.computeIfAbsent(Integer.parseInt(t[1]) * 10 + Integer.parseInt(t[0]), k -> new ArrayList<>()).add(c);
            } catch (NumberFormatException ignored) {
                // not a semester label
            }
        }
        List<TermGpa> result = new ArrayList<>();
        byTerm.forEach((key, list) -> {
            int credits = list.stream().mapToInt(CourseResult::credits).sum();
            double points = list.stream().mapToDouble(c -> GRADE_POINTS.get(c.grade()) * c.credits()).sum();
            if (credits > 0) {
                result.add(new TermGpa(list.get(0).term(), Math.round(points / credits * 100) / 100.0, credits));
            }
        });
        return result;
    }

    private static int parseCredits(String text) {
        try {
            return Integer.parseInt(text.replaceAll("^(\\d+).*$", "$1"));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String codes(List<CourseResult> list) {
        return String.join(", ", list.stream().map(c -> c.code() + " (" + c.grade() + " " + c.term() + ")").toList());
    }

    private static String fmt(String pattern, Object... args) {
        return String.format(Locale.ROOT, pattern, args);
    }
}
