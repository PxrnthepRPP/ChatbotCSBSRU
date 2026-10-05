package com.bsru.studentportal.service;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AcademicRecordService.Course;
import com.bsru.studentportal.service.GraduationAuditService.AuditResult;
import com.bsru.studentportal.service.GraduationAuditService.Unit;
import com.fasterxml.jackson.databind.JsonNode;
import com.bsru.studentportal.service.AcademicRecordService.GradeReport;
import com.bsru.studentportal.service.AcademicRecordService.Semester;
import com.bsru.studentportal.service.TimetableService.OfferedSection;
import com.bsru.studentportal.service.TimetableService.RegistrationStatus;
import com.bsru.studentportal.service.TimetableService.SessionView;
import com.bsru.studentportal.service.TimetableService.TermTimetable;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Read-only tools the chatbot can call to look up the logged-in student's own records.
 * The student is identified only from the memory id that ChatController builds from the
 * verified JWT ("student:<studentId>"), never from anything the user or the model types,
 * so one student cannot ask about another student's data.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StudentRecordTools {

    public static final String STUDENT_MEMORY_PREFIX = "student:";

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("d/M/yyyy HH:mm");

    private static final String NOT_A_STUDENT =
            "ไม่สามารถดูข้อมูลส่วนตัวได้ เพราะผู้ใช้ยังไม่ได้เข้าสู่ระบบในฐานะนักศึกษา ให้แนะนำให้เข้าสู่ระบบด้วยรหัสนักศึกษาก่อน";

    private final StudentRepository studentRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final AcademicRecordService academicRecords;
    private final GraduationAuditService graduationAudits;
    private final TimetableService timetableService;

    @Tool("ดูข้อมูลประวัติของนักศึกษาที่กำลังคุยอยู่: ชื่อ รหัส ชั้นปี GPA สะสม สถานะ และอาจารย์ที่ปรึกษา")
    public String getMyProfile(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        Optional<Student> found = studentRepository.findById(studentId.get());
        if (found.isEmpty()) return "ไม่พบข้อมูลนักศึกษารหัส " + studentId.get() + " ในฐานข้อมูล";

        Student s = found.get();
        StringBuilder sb = new StringBuilder()
                .append("รหัสนักศึกษา: ").append(s.getStudentId()).append('\n')
                .append("ชื่อ: ").append(s.getNameTh()).append(" (").append(s.getNameEn()).append(")\n")
                .append("ชั้นปี: ").append(s.getYear()).append('\n')
                .append("GPA สะสม: ").append(formatGpa(currentGpa(s))).append('\n')
                .append("สถานะ: ").append(s.getStatus()).append('\n');
        if (s.getAdvisor() != null) {
            sb.append("อาจารย์ที่ปรึกษา: ").append(s.getAdvisor().getNameTh())
                    .append(" (อีเมล ").append(s.getAdvisor().getEmail())
                    .append(", โทร ").append(s.getAdvisor().getPhone()).append(")\n");
        }
        return sb.toString();
    }

    @Tool("ดูผลการเรียนรายวิชาทุกภาคเรียนของนักศึกษาที่กำลังคุยอยู่ พร้อม GPA รายภาคและ GPA สะสมที่คำนวณจากรายวิชา")
    public String getMyGrades(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        GradeReport report = academicRecords.gradesOf(studentId.get());
        if (report.isEmpty()) return "ยังไม่มีข้อมูลผลการเรียนรายวิชาของนักศึกษารหัส " + studentId.get() + " ในระบบ";

        StringBuilder sb = new StringBuilder();
        for (Semester sem : report.semesters()) {
            sb.append("== ").append(sem.label()).append(" ==\n");
            for (Course c : sem.courses()) {
                sb.append("- ").append(c.code()).append(' ').append(c.name())
                        .append(" | ").append(c.credits()).append(" หน่วยกิต | เกรด ")
                        .append(c.gradePoint() == null ? "ยังไม่ออกผล" : c.grade()).append('\n');
            }
            if (sem.gpa() != null) {
                sb.append(String.format("GPA ภาคนี้: %.2f (%d หน่วยกิตที่มีเกรด)%n", sem.gpa(), sem.gradedCredits()));
            } else {
                sb.append("GPA ภาคนี้: ยังไม่ออกผล\n");
            }
        }
        if (report.gpa() != null) {
            sb.append(String.format("GPA สะสม: %.2f (%d หน่วยกิตที่มีเกรด)%n", report.gpa(), report.gradedCredits()));
        }
        return sb.toString();
    }

    @Tool("ดูผลตรวจสอบจบของนักศึกษาที่กำลังคุยอยู่ (ข้อมูลชุดเดียวกับหน้า 'ตรวจสอบจบ' บนเว็บ): ผ่าน/ไม่ผ่านรายหมวดตามโครงสร้างหลักสูตร หน่วยกิตที่ได้/ที่ต้องการ GPA และรายการที่ยังขาด รวมถึงชั่วโมงกิจกรรม")
    public String getMyGraduationProgress(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        Optional<AuditResult> found = graduationAudits.auditOf(studentId.get());
        if (found.isEmpty()) return "ยังไม่มีข้อมูลการตรวจสอบจบของนักศึกษารหัส " + studentId.get() + " ในระบบ";

        JsonNode summary = found.get().audit().get("summary");
        StringBuilder sb = new StringBuilder();
        sb.append("ผลนี้คำนวณจากใบตรวจสอบจบชุดเดียวกับหน้า 'ตรวจสอบจบ' บนเว็บ ให้ตอบตามข้อมูลนี้เท่านั้น\n");
        sb.append("สถานะ: ").append(summary.path("status").asText()).append('\n');
        sb.append("หน่วยกิตตามโครงสร้างหลักสูตร: ").append(summary.path("totalEarnedCredits").asInt())
                .append('/').append(summary.path("totalRequiredCredits").asInt()).append('\n');
        sb.append(String.format(Locale.ROOT, "GPA ในใบตรวจสอบจบ: %.2f (เกณฑ์ขั้นต่ำ %.2f) คำนวณจากทุกรายวิชาในใบตรวจสอบจบ%n",
                summary.path("currentGpa").asDouble(), summary.path("minGpa").asDouble()));
        sb.append("หมวดที่ผ่านเกณฑ์: ").append(summary.path("passedCategories").asInt())
                .append('/').append(summary.path("totalCategories").asInt()).append('\n');

        Map<String, List<Unit>> bySection = new LinkedHashMap<>();
        found.get().units().forEach(u -> bySection.computeIfAbsent(u.section(), k -> new ArrayList<>()).add(u));
        bySection.forEach((section, units) -> {
            boolean allPass = units.stream().allMatch(u -> "PASS".equals(u.status()));
            int sectionMin = units.stream().mapToInt(u -> u.minCr() == null ? 0 : u.minCr()).sum();
            int sectionEarned = units.stream().mapToInt(u -> u.minCr() == null ? 0 : Math.min(u.passCr(), u.minCr())).sum();
            sb.append("\n== ").append(section).append(": ").append(allPass ? "ผ่านครบทุกส่วน" : "ยังไม่ผ่าน");
            if (sectionMin > 0) sb.append(" (รวม ").append(sectionEarned).append('/').append(sectionMin).append(" หน่วยกิต)");
            sb.append(" ==\n");
            for (Unit u : units) {
                sb.append("- ").append(u.title()).append(": ").append("PASS".equals(u.status()) ? "ผ่าน" : "ยังไม่ผ่าน")
                        .append(" (").append(u.note()).append(")\n");
            }
        });

        JsonNode pending = summary.path("pendingRequirements");
        sb.append("\nสิ่งที่ยังขาด/รอผล:").append(pending.isEmpty() ? " ไม่มี" : "").append('\n');
        pending.forEach(item -> sb.append("- ").append(item.asText()).append('\n'));

        academicRecords.graduationOf(studentId.get()).ifPresent(g -> sb.append("กิจกรรม: ")
                .append(g.getActivityCompleted()).append('/').append(g.getActivityRequired()).append(" รายการ\n"));
        return sb.toString();
    }

    @Tool("ดูตารางเรียนของนักศึกษาที่กำลังคุยอยู่ทุกภาคเรียน: วิชา วัน เวลา ห้อง อาจารย์ผู้สอน หน่วยกิต section วิชาที่เวลาชนกัน และสถานะเปิด/ปิดลงทะเบียน")
    public String getMyTimetable(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        List<TermTimetable> terms = timetableService.timetableOf(studentId.get());
        if (terms.isEmpty()) return "นักศึกษายังไม่มีรายวิชาในตารางเรียน";

        // "This semester" in the timetable = the semester that has a registration period (the one being
        // registered / studied), the same rule the advisor page uses; the newest year label is not reliable.
        Set<String> inProgress = terms.stream()
                .filter(t -> t.registration() != null)
                .map(t -> t.term() + "/" + t.academicYear())
                .collect(Collectors.toSet());

        StringBuilder sb = new StringBuilder();
        if (!inProgress.isEmpty()) {
            sb.append("ภาคเรียนปัจจุบันในตารางเรียน (เทอมนี้): ").append(String.join(", ", inProgress))
                    .append(" ภาคเรียนอื่นในตารางเรียนเป็นเทอมที่เรียนจบแล้ว เมื่อถูกถามเรื่อง 'เทอมนี้' ให้ตอบจากภาคเรียนปัจจุบันนี้\n\n");
        }
        for (TermTimetable t : terms) {
            String key = t.term() + "/" + t.academicYear();
            sb.append("== ").append(t.label())
                    .append(inProgress.contains(key) ? " (กำลังเรียนอยู่)" : inProgress.isEmpty() ? "" : " (เรียนจบแล้ว)")
                    .append(" | ").append(t.sessions().size()).append(" วิชา ")
                    .append(t.totalCredits()).append(" หน่วยกิต ==\n");
            for (SessionView s : t.sessions()) {
                sb.append("- วัน").append(s.dayName()).append(' ').append(s.startTime()).append('-').append(s.endTime())
                        .append(" | ").append(s.courseCode()).append(' ').append(s.courseName())
                        .append(" | ").append(s.credits()).append(" หน่วยกิต | section ").append(s.sectionNo())
                        .append(" | ห้อง ").append(s.room() == null ? "-" : s.room())
                        .append(" | อาจารย์ ").append(s.instructorName() == null ? "-" : s.instructorName());
                if (s.instructorEmail() != null) sb.append(" (").append(s.instructorEmail()).append(')');
                if (s.enrollmentStatus() == EnrollmentStatus.PENDING) sb.append(" | สถานะ: รอผู้ดูแลระบบยืนยันการลงทะเบียน");
                sb.append('\n');
            }
            List<String> days = t.sessions().stream().map(SessionView::dayName).distinct().toList();
            sb.append("วันที่มีเรียน: ").append(String.join(", ", days)).append('\n');
            sb.append(t.conflicts().isEmpty() ? "เวลาเรียนชนกัน: ไม่มี\n"
                    : "เวลาเรียนชนกัน: " + String.join("; ", t.conflicts()) + '\n');
            if (t.registration() != null) {
                sb.append("การลงทะเบียนภาคนี้: ").append(describe(t.registration())).append('\n');
            }
        }
        return sb.toString();
    }

    @Tool("ค้นหารายวิชาและ section ที่เปิดสอนในภาคเรียนที่มีช่วงลงทะเบียน พร้อมวัน เวลา ห้อง อาจารย์ ที่นั่ง และบอกว่าเวลาชนกับตารางเรียนของนักศึกษาหรือไม่")
    public String findOfferedSections(@ToolMemoryId String memoryId,
                                      @P("รหัสวิชาที่ต้องการค้นหา เช่น CS3402 หรือสตริงว่างเพื่อดูทุกวิชาที่เปิด") String courseCode) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        List<OfferedSection> offered = timetableService.offeredSectionsFor(studentId.get(), courseCode);
        if (offered.isEmpty()) {
            return courseCode == null || courseCode.isBlank()
                    ? "ยังไม่มีรายวิชาที่เปิดให้ลงทะเบียน"
                    : "ไม่มีวิชา " + courseCode.trim() + " เปิดสอนในภาคเรียนที่มีช่วงลงทะเบียน";
        }
        StringBuilder sb = new StringBuilder();
        for (OfferedSection o : offered) {
            SessionView s = o.section();
            sb.append("- ภาค ").append(s.term()).append('/').append(s.academicYear()).append(" | ")
                    .append(s.courseCode()).append(' ').append(s.courseName()).append(" | ").append(s.credits()).append(" หน่วยกิต")
                    .append(" | section ").append(s.sectionNo()).append(" | วัน").append(s.dayName()).append(' ')
                    .append(s.startTime()).append('-').append(s.endTime())
                    .append(" | ห้อง ").append(s.room() == null ? "-" : s.room())
                    .append(" | อาจารย์ ").append(s.instructorName() == null ? "-" : s.instructorName())
                    .append(" | ที่นั่ง ").append(s.enrolledCount()).append('/').append(s.capacity() == null ? "ไม่จำกัด" : s.capacity())
                    .append(" | ").append(o.alreadyEnrolled() ? "ลงทะเบียนแล้ว"
                            : o.clashesWith() != null ? "เวลาชนกับ " + o.clashesWith() : "เวลาไม่ชนกับตารางเรียน")
                    .append('\n');
        }
        return sb.toString();
    }

    @Tool("ดูว่าตอนนี้เปิดให้นักศึกษาเพิ่ม/ลบวิชา (ลงทะเบียน) อยู่หรือไม่ และช่วงวันเวลาเปิด-ปิดของแต่ละภาคเรียน")
    public String getRegistrationStatus() {
        List<RegistrationStatus> periods = timetableService.listPeriods();
        if (periods.isEmpty()) return "ยังไม่มีการกำหนดช่วงลงทะเบียนในระบบ";
        StringBuilder sb = new StringBuilder("เวลาปัจจุบัน: ").append(LocalDateTime.now().format(DATE_TIME)).append('\n');
        for (RegistrationStatus p : periods) {
            sb.append("- ภาคเรียน ").append(p.term()).append('/').append(p.academicYear()).append(": ").append(describe(p)).append('\n');
        }
        return sb.toString();
    }

    @Tool("ดูรายการคำร้องวิชาการที่นักศึกษาที่กำลังคุยอยู่เคยยื่น พร้อมสถานะและความเห็นของผู้พิจารณา")
    public String getMyPetitions(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        List<AcademicPetition> petitions = petitionRepository.findByStudentStudentId(studentId.get());
        if (petitions.isEmpty()) return "นักศึกษายังไม่มีคำร้องวิชาการในระบบ";

        StringBuilder sb = new StringBuilder();
        for (AcademicPetition p : petitions) {
            sb.append("- ").append(p.getId()).append(" | ").append(p.getType())
                    .append(" | ").append(p.getTitle())
                    .append(" | สถานะ ").append(p.getStatus())
                    .append(" | ยื่นเมื่อ ").append(p.getSubmittedAt());
            if (p.getAdminComment() != null) sb.append(" | ความเห็น: ").append(p.getAdminComment());
            sb.append('\n');
        }
        return sb.toString();
    }

    /**
     * The GPA computed from course_grades is the source of truth; the students.gpa column is
     * only used for students who have no course grades recorded yet.
     */
    /** Cumulative GPA: from the graduation audit (every course) when there is one, same as the web pages */
    private Double currentGpa(Student s) {
        Optional<AuditResult> audit = graduationAudits.auditOf(s.getStudentId());
        if (audit.isPresent()) return audit.get().audit().path("summary").path("currentGpa").asDouble();
        Double fromGrades = academicRecords.gradesOf(s.getStudentId()).gpa();
        return fromGrades != null ? fromGrades : s.getGpa();
    }

    private static String describe(RegistrationStatus p) {
        String window = p.opensAt().format(DATE_TIME) + " ถึง " + p.closesAt().format(DATE_TIME);
        if (p.open()) return "เปิดอยู่ (" + window + ") นักศึกษาเพิ่ม/ลบวิชาเองได้ที่หน้าตารางเรียน";
        if (p.forceClosed()) return "ปิดอยู่ (ผู้ดูแลระบบปิดไว้ ช่วงที่กำหนด " + window + ")";
        return "ปิดอยู่ (เปิดเฉพาะช่วง " + window + ")";
    }

    private static String formatGpa(Double gpa) {
        return gpa == null ? "ยังไม่มีข้อมูล" : String.format("%.2f", gpa);
    }

    private Optional<String> studentIdFrom(String memoryId) {
        if (memoryId == null || !memoryId.startsWith(STUDENT_MEMORY_PREFIX)) {
            log.info("Chatbot tool called without a logged-in student (memoryId={})", memoryId);
            return Optional.empty();
        }
        return Optional.of(memoryId.substring(STUDENT_MEMORY_PREFIX.length()));
    }
}
