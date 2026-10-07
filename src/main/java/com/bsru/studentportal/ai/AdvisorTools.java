package com.bsru.studentportal.ai;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.service.AdvisorInsightService;
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

    private static final String NOT_AN_ADVISOR =
            "เครื่องมือนี้ใช้ได้เฉพาะอาจารย์ที่ปรึกษาที่เข้าสู่ระบบแล้วเท่านั้น";

    private final AdvisorInsightService insights;

    @Tool("สำหรับอาจารย์ที่ปรึกษา: ภาพรวมนักศึกษาในความดูแลทุกคน พร้อมระดับความเสี่ยง (พ้นสภาพ/รีไทร์, ตก, ต้องถอนรายวิชา, จบช้า) GPA และเหตุผล เรียงจากเสี่ยงมากไปน้อย")
    public String getMyAdviseesRiskOverview(@ToolMemoryId String memoryId) {
        Optional<String> advisorId = advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_AN_ADVISOR;
        List<AdviseeRisk> risks = insights.risksOf(advisorId.get());
        if (risks.isEmpty()) return "ยังไม่มีนักศึกษาในความดูแล";

        StringBuilder sb = new StringBuilder("นักศึกษาในความดูแล " + risks.size() + " คน (ข้อมูลจริงจากฐานข้อมูล)\n");
        sb.append(AdvisorInsightService.criteriaText()).append('\n');
        for (AdviseeRisk r : risks) {
            sb.append("== ").append(r.studentId()).append(' ').append(r.nameTh())
                    .append(" | ปี ").append(r.year()).append(" | ").append(r.status())
                    .append(" | Sec ").append(r.studentSection())
                    .append(" | GPA ").append(r.gpa() == null ? "-" : String.format(Locale.ROOT, "%.2f", r.gpa()))
                    .append(" (").append(r.gpaSource()).append(")")
                    .append(" | ความเสี่ยง: ").append(levelText(r.level()))
                    .append(r.simulated() ? " | ข้อมูลจำลอง (มีแค่ข้อมูลพื้นฐาน ไม่มีผลการเรียนรายวิชา)" : "").append('\n');
            if (r.factors().isEmpty()) sb.append("  - ไม่พบสัญญาณเสี่ยงตามเกณฑ์\n");
            for (RiskFactor f : r.factors()) {
                sb.append("  - [").append(levelText(f.level())).append("] ").append(f.message())
                        .append(" → ").append(f.suggestion()).append('\n');
            }
        }
        return sb.toString();
    }

    @Tool("สำหรับอาจารย์ที่ปรึกษา: ประวัติและการวิเคราะห์นักศึกษาในความดูแล 1 คน (GPA รายเทอม วิชาที่ได้ F/D ผลตรวจสอบจบ ตารางเรียนเทอมปัจจุบัน คำร้อง และปัจจัยเสี่ยง)")
    public String getAdviseeRecord(@ToolMemoryId String memoryId,
                                   @P("รหัสนักศึกษา 10 หลัก หรือชื่อ/นามสกุลของนักศึกษา") String studentIdOrName) {
        Optional<String> advisorId = advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_AN_ADVISOR;
        String query = studentIdOrName == null ? "" : studentIdOrName.trim();
        Optional<String> studentId = insights.adviseesOf(advisorId.get()).stream()
                .filter(s -> s.getStudentId().equals(query) || s.getNameTh().contains(query)
                        || (s.getNameEn() != null && s.getNameEn().toLowerCase().contains(query.toLowerCase())))
                .map(s -> s.getStudentId())
                .findFirst();
        if (studentId.isEmpty() || query.isEmpty()) {
            return "ไม่พบ \"" + query + "\" ในรายชื่อนักศึกษาในความดูแลของคุณ (ดูได้เฉพาะนักศึกษาในความดูแลเท่านั้น)";
        }
        AdviseeDetail d = insights.detailOf(advisorId.get(), studentId.get()).orElseThrow();
        AdviseeRisk r = d.risk();

        StringBuilder sb = new StringBuilder();
        sb.append(r.studentId()).append(' ').append(r.nameTh()).append(" (").append(r.nameEn()).append(")\n")
                .append("ชั้นปี ").append(r.year()).append(" | สถานะ ").append(r.status()).append(" | Sec ").append(r.studentSection()).append('\n')
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
        if (r.currentTerm() != null) {
            sb.append("เทอมปัจจุบัน (").append(r.currentTerm()).append("): ลงทะเบียน ").append(r.currentCredits()).append(" หน่วยกิต");
            sb.append(r.conflicts().isEmpty() ? ", ไม่มีวิชาเวลาชน\n" : ", เวลาชน: " + String.join(", ", r.conflicts()) + '\n');
        }
        if (!d.petitions().isEmpty()) {
            sb.append("คำร้อง: ");
            for (AcademicPetition p : d.petitions()) sb.append(p.getTitle()).append(" [").append(p.getStatus()).append("]; ");
            sb.append('\n');
        }
        sb.append("ระดับความเสี่ยง: ").append(levelText(r.level())).append('\n');
        if (r.factors().isEmpty()) sb.append("- ไม่พบสัญญาณเสี่ยงตามเกณฑ์\n");
        for (RiskFactor f : r.factors()) {
            sb.append("- [").append(levelText(f.level())).append("] ").append(f.message()).append(" → ").append(f.suggestion()).append('\n');
        }
        return sb.toString();
    }

    static Optional<String> advisorIdFrom(String memoryId) {
        if (memoryId == null || !memoryId.startsWith(ADVISOR_MEMORY_PREFIX)) return Optional.empty();
        String id = memoryId.substring(ADVISOR_MEMORY_PREFIX.length());
        return id.isBlank() ? Optional.empty() : Optional.of(id);
    }

    private static String levelText(Level level) {
        return switch (level) {
            case HIGH -> "สูง";
            case MEDIUM -> "ปานกลาง";
            case LOW -> "ต่ำ/ปกติ";
        };
    }
}
