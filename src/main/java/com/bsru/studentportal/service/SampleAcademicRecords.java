package com.bsru.studentportal.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Read-only sample course grades and graduation progress.
 * The database has no course/grade tables yet, so this mirrors the
 * MOCK_GRADES / MOCK_GRADUATION data in js/roles/student.js for the
 * demo student 6421100042 (สมชาย ใจดี) so the chatbot and the UI agree.
 */
@Component
public class SampleAcademicRecords {

    public record Course(String code, String name, int credits, String grade, Double point) {}

    public record Semester(String label, List<Course> courses) {}

    public record GraduationProgress(
            int requiredCredits, int earnedCredits,
            int coreRequired, int coreEarned,
            int geRequired, int geEarned,
            int electiveRequired, int electiveEarned,
            int freeRequired, int freeEarned,
            double gpaRequired, double currentGpa,
            int activityRequired, int activityCompleted,
            String status) {}

    private static final Map<String, List<Semester>> GRADES = Map.of(
            "6421100042", List.of(
                    new Semester("Term 2/2566", List.of(
                            new Course("CS2301", "ระบบฐานข้อมูล", 3, "A", 4.0),
                            new Course("CS2302", "การเขียนโปรแกรมเว็บ", 3, "A", 4.0),
                            new Course("CS2303", "ระบบจัดการฐานข้อมูล (Lab)", 1, "A", 4.0),
                            new Course("CS2401", "วิศวกรรมความต้องการ", 3, "B+", 3.5),
                            new Course("MA2101", "สถิติสำหรับวิทยาการคอมพิวเตอร์", 3, "B", 3.0),
                            new Course("GE1301", "จิตวิทยาทั่วไป", 3, "A", 4.0))),
                    new Semester("Term 1/2566", List.of(
                            new Course("CS2101", "โครงสร้างข้อมูล", 3, "A", 4.0),
                            new Course("CS2102", "การวิเคราะห์อัลกอริทึม", 3, "B+", 3.5),
                            new Course("CS2201", "สถาปัตยกรรมคอมพิวเตอร์", 3, "A", 4.0),
                            new Course("CS2103", "ระบบปฏิบัติการ", 3, "B+", 3.5),
                            new Course("GE1201", "คณิตศาสตร์ดิสครีต", 3, "B", 3.0),
                            new Course("GE1102", "ภาษาอังกฤษเพื่อการสื่อสาร", 3, "A", 4.0))),
                    new Semester("Term 2/2565", List.of(
                            new Course("CS3101", "ปัญญาประดิษฐ์", 3, "-", null),
                            new Course("CS3102", "วิศวกรรมซอฟต์แวร์", 3, "-", null),
                            new Course("CS3201", "ระบบฐานข้อมูลขั้นสูง", 3, "-", null),
                            new Course("CS3301", "เครือข่ายคอมพิวเตอร์", 3, "-", null),
                            new Course("CS3103", "การพัฒนาเว็บแอปพลิเคชัน", 3, "-", null),
                            new Course("GE2301", "ภาษาอังกฤษเชิงวิชาการ", 3, "-", null)))
            )
    );

    private static final Map<String, GraduationProgress> GRADUATION = Map.of(
            "6421100042", new GraduationProgress(
                    132, 96, 72, 54, 30, 24, 18, 12, 12, 6,
                    2.0, 3.42, 6, 4, "กำลังดำเนินการ")
    );

    public Optional<List<Semester>> findGrades(String studentId) {
        return Optional.ofNullable(GRADES.get(studentId));
    }

    public Optional<GraduationProgress> findGraduation(String studentId) {
        return Optional.ofNullable(GRADUATION.get(studentId));
    }
}
