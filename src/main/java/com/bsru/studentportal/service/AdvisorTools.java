package com.bsru.studentportal.service;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.service.AcademicRecordService.Course;
import com.bsru.studentportal.service.AcademicRecordService.GradeReport;
import com.bsru.studentportal.service.AcademicRecordService.Semester;
import com.bsru.studentportal.service.TimetableService.SessionView;
import com.bsru.studentportal.service.TimetableService.TermTimetable;
import com.bsru.studentportal.service.AdvisorInsightService.AdviseeDetail;
import com.bsru.studentportal.service.AdvisorInsightService.AdviseeRisk;
import com.bsru.studentportal.service.AdvisorInsightService.Level;
import com.bsru.studentportal.service.AdvisorInsightService.RiskFactor;
import com.bsru.studentportal.service.AdvisorInsightService.TermGpa;
import com.bsru.studentportal.service.GraduationAuditService.Unit;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Chatbot tools for advisors. The advisor is identified only from the memory id that ChatController
 * builds from the verified JWT ("advisor:<advisorId>"), and every answer is limited to that
 * advisor's own advisees.
 */
@Component
@RequiredArgsConstructor
public class AdvisorTools {

    public static final String ADVISOR_MEMORY_PREFIX = "advisor:";
    /** Added by ChatController for the demo "advisor" login only: the tools then cover every real student and course */
    public static final String SEES_ALL_SUFFIX = ":all";

    private static final String NOT_AN_ADVISOR =
            "เครื่องมือนี้ใช้ได้เฉพาะอาจารย์ที่ปรึกษาที่เข้าสู่ระบบแล้วเท่านั้น";

    /** Personal data (PDPA) the advisor AI never receives; the advisor is pointed to the admin instead */
    static final String PDPA_NOTE = "ข้อมูลส่วนบุคคลตาม PDPA (เบอร์โทร อีเมล วันเกิด ศาสนา ที่อยู่) ไม่เปิดให้ทางแชทบอท "
            + "หากอาจารย์ต้องการข้อมูลติดต่อนักศึกษา ให้ติดต่อผู้ดูแลระบบ\n";

    private final AdvisorInsightService insights;
    private final AcademicRecordService academicRecords;

    @Tool("สำหรับอาจารย์ที่ปรึกษา: ภาพรวมนักศึกษาในความดูแลทุกคน พร้อมระดับความเสี่ยง (พ้นสภาพ/รีไทร์, ตก, ต้องถอนรายวิชา, จบช้า) GPA และเหตุผล เรียงจากเสี่ยงมากไปน้อย")
    public String getMyAdviseesRiskOverview(@ToolMemoryId String memoryId) {
        Optional<String> advisorId = advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_AN_ADVISOR;
        // Real students only; simulated (sample) students are not counted
        boolean all = seesAll(memoryId);
        List<AdviseeRisk> risks = (all ? insights.risksOfAllReal() : insights.risksOf(advisorId.get())).stream()
                .filter(r -> !r.simulated()).toList();
        if (risks.isEmpty()) return "ยังไม่มีนักศึกษาจริงในความดูแล (ผู้ดูแลระบบเป็นผู้กำหนดอาจารย์ที่ปรึกษาประจำรุ่น)";

        StringBuilder sb = new StringBuilder(all
                ? "บัญชีทดลอง advisor: ดูได้นักศึกษาจริงทุกคน " + risks.size() + " คน (ข้อมูลจริงจากฐานข้อมูล)\n"
                : "นักศึกษาในความดูแล " + risks.size() + " คน (ข้อมูลจริงจากฐานข้อมูล)\n");
        sb.append(AdvisorInsightService.criteriaText()).append('\n');
        for (AdviseeRisk r : risks) {
            sb.append("== ").append(r.studentId()).append(' ').append(r.nameTh())
                    .append(" | ปี ").append(r.year()).append(" | ").append(r.status())
                    .append(" | Sec แรกเข้า ").append(r.studentSection())
                    .append(" | GPA ").append(r.gpa() == null ? "-" : String.format(Locale.ROOT, "%.2f", r.gpa()))
                    .append(" (").append(r.gpaSource()).append(")")
                    .append(" | ความเสี่ยง: ").append(levelText(r.level())).append('\n');
            if (r.factors().isEmpty()) sb.append("  - ไม่พบสัญญาณเสี่ยงตามเกณฑ์\n");
            for (RiskFactor f : r.factors()) {
                sb.append("  - [").append(levelText(f.level())).append("] ").append(f.message())
                        .append(" → ").append(f.suggestion()).append('\n');
            }
        }
        return sb.toString();
    }

    @Tool("สำหรับอาจารย์ที่ปรึกษา: ข้อมูลทั้งหมดของนักศึกษาในความดูแล 1 คน (ยกเว้นข้อมูลส่วนบุคคลตาม PDPA): ประวัติการศึกษา เกรดทุกรายวิชาทุกเทอม GPA รายเทอม ตารางเรียนทุกเทอม (วิชา Sec วัน เวลา) กิจกรรม ผลตรวจสอบจบ คำร้อง แผนอาชีพ และปัจจัยเสี่ยง")
    public String getAdviseeRecord(@ToolMemoryId String memoryId,
                                   @P("รหัสนักศึกษา 10 หลัก หรือชื่อ/นามสกุลของนักศึกษา") String studentIdOrName) {
        Optional<String> advisorId = advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_AN_ADVISOR;
        String query = studentIdOrName == null ? "" : studentIdOrName.trim();
        boolean all = seesAll(memoryId);
        Optional<String> studentId = (all ? insights.allRealStudents() : insights.adviseesOf(advisorId.get())).stream()
                .filter(s -> !s.isSimulated())
                .filter(s -> s.getStudentId().equals(query) || s.getNameTh().contains(query)
                        || (s.getNameEn() != null && s.getNameEn().toLowerCase().contains(query.toLowerCase())))
                .map(s -> s.getStudentId())
                .findFirst();
        if (studentId.isEmpty() || query.isEmpty()) {
            return "ไม่พบ \"" + query + "\" ในรายชื่อนักศึกษาในความดูแลของคุณ (ดูได้เฉพาะนักศึกษาในความดูแลเท่านั้น)";
        }
        AdviseeDetail d = (all ? insights.detailOfAny(studentId.get())
                : insights.detailOf(advisorId.get(), studentId.get())).orElseThrow();
        AdviseeRisk r = d.risk();

        Student p = d.profile();
        StringBuilder sb = new StringBuilder(PDPA_NOTE);
        sb.append(r.studentId()).append(' ').append(r.nameTh()).append(" (").append(r.nameEn()).append(")\n")
                .append("ชั้นปี ").append(r.year()).append(" | สถานะ ").append(r.status())
                .append(" | Sec แรกเข้า ").append(r.studentSection()).append(" (Sec ของแต่ละวิชาดูจากตารางเรียน)\n")
                .append(p.getFaculty() == null ? "" : p.getFaculty() + " ")
                .append(p.getDepartment() == null ? "" : p.getDepartment() + " ")
                .append(p.getAdmissionYear() == null ? "" : "| เข้าศึกษาปี " + p.getAdmissionYear()).append('\n')
                .append("GPA สะสม: ").append(r.gpa() == null ? "-" : String.format(Locale.ROOT, "%.2f", r.gpa()))
                .append(" (ที่มา: ").append(r.gpaSource()).append(")\n");
        if (r.earnedCredits() != null) {
            sb.append("หน่วยกิตตามหลักสูตร: ").append(r.earnedCredits()).append('/').append(r.requiredCredits())
                    .append(" (ตามแผนควรมีประมาณ ").append(r.expectedCredits()).append(")\n");
        }
        sb.append("GPA รายเทอม: ");
        for (TermGpa t : r.terms()) sb.append(t.term()).append('=').append(String.format(Locale.ROOT, "%.2f", t.gpa())).append(' ');
        sb.append('\n').append("จำนวนเกรด: ").append(r.gradeCounts()).append('\n');
        if (!r.failedCourses().isEmpty()) {
            sb.append("วิชาที่ได้ F: ");
            r.failedCourses().forEach(c -> sb.append(c.code()).append(' ').append(c.name()).append(" (").append(c.term()).append("); "));
            sb.append('\n');
        }
        if (!r.lowGradeCourses().isEmpty()) {
            sb.append("วิชาที่ได้ D/D+: ");
            r.lowGradeCourses().forEach(c -> sb.append(c.code()).append(' ').append(c.name()).append(' ').append(c.grade()).append(" (").append(c.term()).append("); "));
            sb.append('\n');
        }
        if (d.auditSummary() != null) {
            sb.append("ตรวจสอบจบ: ").append(d.auditSummary().path("status").asText())
                    .append(", ผ่าน ").append(d.auditSummary().path("passedCategories").asInt()).append('/')
                    .append(d.auditSummary().path("totalCategories").asInt()).append(" หมวด\n");
            for (Unit u : d.auditUnits()) {
                if (!"PASS".equals(u.status())) sb.append("  - ยังไม่ผ่าน ").append(u.title()).append(": ").append(u.note()).append('\n');
            }
        }
        academicRecords.graduationOf(r.studentId()).ifPresent(g -> sb.append("กิจกรรม: ")
                .append(g.getActivityCompleted()).append('/').append(g.getActivityRequired()).append(" รายการ\n"));
        if (r.currentTerm() != null) {
            sb.append("เทอมปัจจุบัน (").append(r.currentTerm()).append("): ลงทะเบียน ").append(r.currentCredits()).append(" หน่วยกิต");
            sb.append(r.conflicts().isEmpty() ? ", ไม่มีวิชาเวลาชน\n" : ", เวลาชน: " + String.join(", ", r.conflicts()) + '\n');
        }
        appendGrades(sb, academicRecords.gradesOf(r.studentId()));
        appendTimetable(sb, d.timetable());
        if (!d.petitions().isEmpty()) {
            sb.append("คำร้อง: ");
            for (AcademicPetition pt : d.petitions()) sb.append(pt.getTitle()).append(" [").append(pt.getStatus()).append("]; ");
            sb.append('\n');
        }
        if (p.getCareerPath() != null || p.getEmploymentStatus() != null) {
            sb.append("แผน/สายอาชีพ: ").append(p.getCareerPath() == null ? "-" : p.getCareerPath())
                    .append(" | สถานะการทำงาน: ").append(p.getEmploymentStatus() == null ? "-" : p.getEmploymentStatus())
                    .append(p.getCompanyName() == null ? "" : " | บริษัท " + p.getCompanyName())
                    .append(p.getSalaryRange() == null ? "" : " | เงินเดือน " + p.getSalaryRange()).append('\n');
        }
        sb.append("ระดับความเสี่ยง: ").append(levelText(r.level())).append('\n');
        if (r.factors().isEmpty()) sb.append("- ไม่พบสัญญาณเสี่ยงตามเกณฑ์\n");
        for (RiskFactor f : r.factors()) {
            sb.append("- [").append(levelText(f.level())).append("] ").append(f.message()).append(" → ").append(f.suggestion()).append('\n');
        }
        return sb.toString();
    }

    /** Every course and grade, term by term */
    private static void appendGrades(StringBuilder sb, GradeReport report) {
        if (report.isEmpty()) return;
        sb.append("ผลการเรียนรายวิชา:\n");
        for (Semester sem : report.semesters()) {
            sb.append("== ").append(sem.label())
                    .append(sem.gpa() == null ? " (ยังไม่ออกผล)" : String.format(Locale.ROOT, " GPA %.2f", sem.gpa()))
                    .append(" | ").append(sem.registeredCredits()).append(" หน่วยกิต\n");
            for (Course c : sem.courses()) {
                sb.append("  - ").append(c.code()).append(' ').append(c.name()).append(" (").append(c.credits())
                        .append(" นก.): ").append(c.grade() == null ? "ยังไม่ออกผล" : c.grade()).append('\n');
            }
        }
    }

    /** Courses, Sec, day and time of every term in the timetable */
    private static void appendTimetable(StringBuilder sb, List<TermTimetable> terms) {
        if (terms.isEmpty()) return;
        sb.append("ตารางเรียน:\n");
        for (TermTimetable t : terms) {
            sb.append("== ").append(t.label()).append(" | ").append(t.sessions().size()).append(" วิชา ")
                    .append(t.totalCredits()).append(" หน่วยกิต\n");
            for (SessionView s : t.sessions()) {
                sb.append("  - ").append(s.courseCode()).append(' ').append(s.courseName())
                        .append(" | Sec ").append(s.sectionNo())
                        .append(" | ").append(s.dayName()).append(' ').append(s.startTime()).append('-').append(s.endTime())
                        .append(" | อาจารย์ ").append(s.instructorName() == null ? "-" : s.instructorName())
                        .append(s.enrollmentStatus() == EnrollmentStatus.PENDING ? " | รอผู้ดูแลระบบยืนยัน" : "")
                        .append('\n');
            }
        }
    }

    static Optional<String> advisorIdFrom(String memoryId) {
        if (memoryId == null || !memoryId.startsWith(ADVISOR_MEMORY_PREFIX)) return Optional.empty();
        String id = memoryId.substring(ADVISOR_MEMORY_PREFIX.length());
        if (id.endsWith(SEES_ALL_SUFFIX)) id = id.substring(0, id.length() - SEES_ALL_SUFFIX.length());
        return id.isBlank() ? Optional.empty() : Optional.of(id);
    }

    /** True only for the demo "advisor" login (see ChatController) */
    static boolean seesAll(String memoryId) {
        return advisorIdFrom(memoryId).isPresent() && memoryId.endsWith(SEES_ALL_SUFFIX);
    }

    private static String levelText(Level level) {
        return switch (level) {
            case HIGH -> "สูง";
            case MEDIUM -> "ปานกลาง";
            case LOW -> "ต่ำ/ปกติ";
        };
    }
}
