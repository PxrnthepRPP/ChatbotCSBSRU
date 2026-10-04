package com.bsru.studentportal.service;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.SampleAcademicRecords.Course;
import com.bsru.studentportal.service.SampleAcademicRecords.GraduationProgress;
import com.bsru.studentportal.service.SampleAcademicRecords.Semester;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

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

    private static final String NOT_A_STUDENT =
            "ไม่สามารถดูข้อมูลส่วนตัวได้ เพราะผู้ใช้ยังไม่ได้เข้าสู่ระบบในฐานะนักศึกษา ให้แนะนำให้เข้าสู่ระบบด้วยรหัสนักศึกษาก่อน";

    private final StudentRepository studentRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final SampleAcademicRecords sampleRecords;

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
                .append("GPA สะสม: ").append(s.getGpa()).append('\n')
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

        Optional<List<Semester>> semesters = sampleRecords.findGrades(studentId.get());
        if (semesters.isEmpty()) return "ยังไม่มีข้อมูลผลการเรียนรายวิชาของนักศึกษารหัส " + studentId.get() + " ในระบบ";

        StringBuilder sb = new StringBuilder();
        double totalPoints = 0;
        int totalCredits = 0;
        for (Semester sem : semesters.get()) {
            sb.append("== ").append(sem.label()).append(" ==\n");
            double semPoints = 0;
            int semCredits = 0;
            for (Course c : sem.courses()) {
                sb.append("- ").append(c.code()).append(' ').append(c.name())
                        .append(" | ").append(c.credits()).append(" หน่วยกิต | เกรด ")
                        .append(c.point() == null ? "ยังไม่ออกผล" : c.grade()).append('\n');
                if (c.point() != null) {
                    semPoints += c.point() * c.credits();
                    semCredits += c.credits();
                }
            }
            if (semCredits > 0) {
                sb.append(String.format("GPA ภาคนี้: %.2f (%d หน่วยกิตที่มีเกรด)%n", semPoints / semCredits, semCredits));
            } else {
                sb.append("GPA ภาคนี้: ยังไม่ออกผล\n");
            }
            totalPoints += semPoints;
            totalCredits += semCredits;
        }
        if (totalCredits > 0) {
            sb.append(String.format("GPA เฉลี่ยจากรายวิชาที่แสดงด้านบน: %.2f (%d หน่วยกิต)%n", totalPoints / totalCredits, totalCredits));
        }
        return sb.toString();
    }

    @Tool("ดูความคืบหน้าการตรวจสอบจบของนักศึกษาที่กำลังคุยอยู่: หน่วยกิตที่ได้แยกตามหมวด เกณฑ์ GPA และชั่วโมงกิจกรรม")
    public String getMyGraduationProgress(@ToolMemoryId String memoryId) {
        Optional<String> studentId = studentIdFrom(memoryId);
        if (studentId.isEmpty()) return NOT_A_STUDENT;

        Optional<GraduationProgress> found = sampleRecords.findGraduation(studentId.get());
        if (found.isEmpty()) return "ยังไม่มีข้อมูลการตรวจสอบจบของนักศึกษารหัส " + studentId.get() + " ในระบบ";

        GraduationProgress g = found.get();
        return String.format("""
                สถานะการตรวจสอบจบ: %s
                หน่วยกิตรวม: %d/%d (ขาดอีก %d)
                - หมวดวิชาเฉพาะ: %d/%d
                - หมวดศึกษาทั่วไป: %d/%d
                - หมวดวิชาเลือก: %d/%d
                - หมวดเลือกเสรี: %d/%d
                GPA ปัจจุบัน: %.2f (เกณฑ์ขั้นต่ำ %.2f)
                กิจกรรม: %d/%d รายการ
                """,
                g.status(),
                g.earnedCredits(), g.requiredCredits(), g.requiredCredits() - g.earnedCredits(),
                g.coreEarned(), g.coreRequired(),
                g.geEarned(), g.geRequired(),
                g.electiveEarned(), g.electiveRequired(),
                g.freeEarned(), g.freeRequired(),
                g.currentGpa(), g.gpaRequired(),
                g.activityCompleted(), g.activityRequired());
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

    private Optional<String> studentIdFrom(String memoryId) {
        if (memoryId == null || !memoryId.startsWith(STUDENT_MEMORY_PREFIX)) {
            log.info("Chatbot tool called without a logged-in student (memoryId={})", memoryId);
            return Optional.empty();
        }
        return Optional.of(memoryId.substring(STUDENT_MEMORY_PREFIX.length()));
    }
}
