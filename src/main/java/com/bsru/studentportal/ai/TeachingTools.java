package com.bsru.studentportal.ai;

import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.service.TeachingRosterService;
import com.bsru.studentportal.service.TeachingRosterService.TaughtSection;
import com.bsru.studentportal.service.TeachingRosterService.TaughtStudent;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Chatbot tools for a teacher (any advisor who teaches). The teacher is taken from the memory id
 * ("advisor:<advisorId>") built from the verified JWT. Answers cover only the sections they teach, every
 * year and term, and only the data of that course (enrollment, Sec, grade of the course).
 */
@Component
@RequiredArgsConstructor
public class TeachingTools {

    private static final String NOT_A_TEACHER = "เครื่องมือนี้ใช้ได้เฉพาะอาจารย์ที่เข้าสู่ระบบแล้วเท่านั้น";
    private static final String SCOPE_NOTE = "ขอบเขต: เฉพาะข้อมูลในรายวิชาที่คุณสอน (การลงทะเบียน Sec และเกรดของวิชานั้น) "
            + "ข้อมูลอื่นของนักศึกษาดูได้เฉพาะอาจารย์ที่ปรึกษาของนักศึกษาคนนั้น\n";

    private final TeachingRosterService roster;

    @Tool("สำหรับอาจารย์ผู้สอน: รายวิชาและกลุ่มเรียน (Sec) ทั้งหมดที่ตนเองสอนทุกปีการศึกษา/ภาคเรียน พร้อมวัน เวลา ห้อง และจำนวนนักศึกษา")
    public String getMyTeachingCourses(@ToolMemoryId String memoryId) {
        Optional<String> advisorId = AdvisorTools.advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_A_TEACHER;
        List<TaughtSection> sections = sections(memoryId, advisorId.get());
        if (sections.isEmpty()) return "ยังไม่มีรายวิชาที่คุณเป็นผู้สอนในระบบ";

        StringBuilder sb = new StringBuilder("รายวิชาที่คุณสอน " + sections.size() + " กลุ่มเรียน (ข้อมูลจริง ไม่รวมนักศึกษาจำลอง)\n");
        String lastTerm = null;
        for (TaughtSection s : sections) {
            String term = s.term() + "/" + s.academicYear();
            if (!term.equals(lastTerm)) sb.append("== ภาค ").append(term).append(" ==\n");
            lastTerm = term;
            long pending = s.students().stream().filter(st -> st.enrollmentStatus() == EnrollmentStatus.PENDING).count();
            sb.append("- ").append(s.courseCode()).append(' ').append(s.courseName())
                    .append(" | Sec ").append(s.sectionNo())
                    .append(" | ").append(s.dayName()).append(' ').append(s.startTime()).append('-').append(s.endTime())
                    .append(" | ห้อง ").append(s.room() == null ? "-" : s.room())
                    .append(" | นักศึกษา ").append(s.students().size() - pending).append(" คน")
                    .append(pending > 0 ? " (+รอยืนยัน " + pending + ")" : "")
                    .append(s.approvalStatus() == com.bsru.studentportal.model.ClassSection.ApprovalStatus.APPROVED
                            ? "" : " | กลุ่มเรียนสถานะ " + s.approvalStatus())
                    .append('\n');
        }
        return sb.toString();
    }

    @Tool("สำหรับอาจารย์ผู้สอน: รายชื่อนักศึกษาและเกรดในรายวิชาที่ตนเองสอน แยกตามวิชา/ภาค/Sec พร้อมสรุปการกระจายเกรด ไม่ระบุรหัสวิชา = ทุกวิชาที่สอน ระบุปีการศึกษา/ภาคเรียนได้เพื่อดูย้อนหลัง")
    public String getStudentsInMyCourse(@ToolMemoryId String memoryId,
                                        @P(value = "รหัสวิชา เช่น CS3401 ไม่ระบุ = ทุกวิชาที่สอน", required = false) String courseCode,
                                        @P(value = "ปีการศึกษา พ.ศ. เช่น 2565 ไม่ระบุ = ทุกปี", required = false) Integer academicYear,
                                        @P(value = "ภาคเรียน 1, 2 หรือ 3 ไม่ระบุ = ทุกภาค", required = false) Integer term) {
        Optional<String> advisorId = AdvisorTools.advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_A_TEACHER;
        String code = courseCode == null ? "" : courseCode.trim();
        List<TaughtSection> sections = sections(memoryId, advisorId.get()).stream()
                .filter(s -> code.isEmpty() || s.courseCode().equalsIgnoreCase(code))
                .filter(s -> academicYear == null || s.academicYear() == academicYear)
                .filter(s -> term == null || s.term() == term)
                .toList();
        if (sections.isEmpty()) {
            return "ไม่พบวิชา " + (code.isEmpty() ? "ที่สอน" : code) + (academicYear != null ? " ปี " + academicYear : "") + (term != null ? " ภาค " + term : "")
                    + " ในรายวิชาที่คุณสอน (ดูได้เฉพาะวิชาที่คุณเป็นผู้สอนเท่านั้น)";
        }

        StringBuilder sb = new StringBuilder(SCOPE_NOTE);
        for (TaughtSection s : sections) {
            sb.append("== ").append(s.courseCode()).append(' ').append(s.courseName())
                    .append(" | ภาค ").append(s.term()).append('/').append(s.academicYear())
                    .append(" | Sec ").append(s.sectionNo())
                    .append(" | ").append(s.dayName()).append(' ').append(s.startTime()).append('-').append(s.endTime())
                    .append(" | ").append(s.students().size()).append(" คน ==\n");
            if (s.students().isEmpty()) sb.append("(ยังไม่มีนักศึกษา)\n");
            Map<String, Integer> distribution = new TreeMap<>();
            for (TaughtStudent st : s.students()) {
                sb.append("- ").append(st.studentId()).append(' ').append(st.nameTh())
                        .append(" | ชั้นปี ").append(st.year())
                        .append(" | เกรดวิชานี้: ").append(gradeText(st))
                        .append(st.enrollmentStatus() == EnrollmentStatus.PENDING ? " | รอผู้ดูแลระบบยืนยันการลงทะเบียน" : "")
                        .append(st.advisee() ? " | นักศึกษาในที่ปรึกษาของคุณ" : "")
                        .append('\n');
                if (st.grade() != null) distribution.merge(st.grade(), 1, Integer::sum);
            }
            appendSummary(sb, s.students(), distribution);
        }
        return sb.toString();
    }

    @Tool("สำหรับอาจารย์ผู้สอน: ข้อมูลของนักศึกษา 1 คนเฉพาะในรายวิชาที่ตนเองสอน (วิชา ภาค Sec เกรดของวิชานั้น) ทุกปีการศึกษา")
    public String getStudentInMyCourses(@ToolMemoryId String memoryId,
                                        @P("รหัสนักศึกษา 10 หลัก หรือชื่อ/นามสกุลของนักศึกษา") String studentIdOrName) {
        Optional<String> advisorId = AdvisorTools.advisorIdFrom(memoryId);
        if (advisorId.isEmpty()) return NOT_A_TEACHER;
        String query = studentIdOrName == null ? "" : studentIdOrName.trim();
        if (query.isEmpty()) return "กรุณาระบุรหัสหรือชื่อนักศึกษา";

        StringBuilder rows = new StringBuilder();
        TaughtStudent found = null;
        for (TaughtSection s : sections(memoryId, advisorId.get())) {
            for (TaughtStudent st : s.students()) {
                boolean match = found == null
                        ? st.studentId().equals(query) || st.nameTh().contains(query)
                        : st.studentId().equals(found.studentId());
                if (!match) continue;
                found = st;
                rows.append("- ").append(s.courseCode()).append(' ').append(s.courseName())
                        .append(" | ภาค ").append(s.term()).append('/').append(s.academicYear())
                        .append(" | Sec ").append(s.sectionNo())
                        .append(" | เกรด: ").append(gradeText(st))
                        .append(st.enrollmentStatus() == EnrollmentStatus.PENDING ? " | รอผู้ดูแลระบบยืนยันการลงทะเบียน" : "")
                        .append('\n');
            }
        }
        if (found == null) {
            return "ไม่พบ \"" + query + "\" ในรายวิชาที่คุณสอน (ดูได้เฉพาะนักศึกษาที่ลงเรียนวิชาของคุณ หรือนักศึกษาในที่ปรึกษาผ่านเครื่องมือของอาจารย์ที่ปรึกษา)";
        }
        StringBuilder sb = new StringBuilder(SCOPE_NOTE);
        sb.append(found.studentId()).append(' ').append(found.nameTh()).append(" | ชั้นปี ").append(found.year()).append('\n');
        if (found.advisee()) {
            sb.append("นักศึกษาคนนี้อยู่ในที่ปรึกษาของคุณด้วย ใช้เครื่องมือประวัตินักศึกษาในความดูแลเพื่อดูข้อมูลครบทุกด้าน\n");
        }
        sb.append("วิชาที่เรียนกับคุณ:\n").append(rows);
        return sb.toString();
    }

    /** The teacher's own sections; every section for the demo "advisor" login */
    private List<TaughtSection> sections(String memoryId, String advisorId) {
        return AdvisorTools.seesAll(memoryId) ? roster.allSections(advisorId) : roster.sectionsTaughtBy(advisorId);
    }

    private static String gradeText(TaughtStudent st) {
        if (st.grade() == null) return "ยังไม่ออกผล";
        return st.grade() + (st.gradePoint() == null ? "" : String.format(Locale.ROOT, " (%.1f)", st.gradePoint()));
    }

    private static void appendSummary(StringBuilder sb, List<TaughtStudent> students, Map<String, Integer> distribution) {
        if (distribution.isEmpty()) return;
        sb.append("การกระจายเกรด: ");
        distribution.forEach((g, n) -> sb.append(g).append('=').append(n).append(' '));
        double[] points = students.stream().filter(st -> st.gradePoint() != null).mapToDouble(TaughtStudent::gradePoint).toArray();
        if (points.length > 0) {
            double avg = java.util.Arrays.stream(points).average().orElse(0);
            sb.append(String.format(Locale.ROOT, "| ค่าเฉลี่ยเกรด %.2f", avg));
        }
        sb.append('\n');
    }
}
