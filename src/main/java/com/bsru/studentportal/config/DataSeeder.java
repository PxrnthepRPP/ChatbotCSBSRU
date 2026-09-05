package com.bsru.studentportal.config;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final AdvisorRepository advisorRepository;
    private final StudentRepository studentRepository;
    private final AcademicPetitionRepository petitionRepository;

    @Override
    public void run(String... args) {
        if (advisorRepository.count() == 0) {
            log.info("Seeding initial Advisors, Students, and Petitions...");

            Advisor adv1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย ใจดี", "Asst. Prof. Dr. Somchai Jaidee", "somchai.j@bsru.ac.th", "081-234-5678", "สาขาวิทยาการคอมพิวเตอร์");
            Advisor adv2 = new Advisor("ADV-02", "ดร.สุดา สวยงาม", "Dr. Suda Suayngam", "suda.s@bsru.ac.th", "082-345-6789", "สาขาวิทยาการคอมพิวเตอร์");
            Advisor adv3 = new Advisor("ADV-03", "ศ.ดร.อนันต์ ยอดเยี่ยม", "Prof. Dr. Anan Yodyeam", "anan.y@bsru.ac.th", "083-456-7890", "สาขาวิทยาการคอมพิวเตอร์");
            List.of(adv1, adv2, adv3).forEach(advisorRepository::save);

            Student s1 = createStudent("6421100042", "นายธนภัทร รุ่งเรือง", "Mr. Thanapat Rungrueang", 3, 3.45, "กำลังศึกษา", "Software Engineer", "งานตรงสาย (IT & CS)", "Agoda", "30,000 - 45,000 บาท", adv1);
            Student s2 = createStudent("6421100015", "นางสาววิภาดา แก้วใส", "Miss Wiphada Kaewsai", 3, 3.82, "กำลังศึกษา", "Data Scientist", "งานตรงสาย (IT & CS)", "SCB TechX", "30,000 - 45,000 บาท", adv2);
            Student s3 = createStudent("6521100088", "นายกิตติศักดิ์ พรหมดี", "Mr. Kittisak Promdee", 2, 2.95, "กำลังศึกษา", "DevOps Engineer", "งานตรงสาย (IT & CS)", "KBTG", "30,000 - 45,000 บาท", adv1);
            Student s4 = createStudent("6621100003", "นางสาวกานต์รวี เจริญผล", "Miss Kanrawee Charoenphol", 1, 3.60, "กำลังศึกษา", "AI & ML Specialist", "งานตรงสาย (IT & CS)", "LINE MAN Wongnai", "45,000 - 60,000 บาท", adv3);
            List.of(s1, s2, s3, s4).forEach(studentRepository::save);

            AcademicPetition p1 = new AcademicPetition("PET-2567-001", "คำร้องขอเทียบโอน", "ขอเทียบโอนรายวิชา SC17351", "ขอเทียบโอนรายวิชาจากมหาวิทยาลัยเดิมเนื่องจากมีเนื้อหาครอบคลุม", "transcript_verified.pdf", LocalDateTime.now().minusDays(2), "APPROVED", "เอกสารครบถ้วน อนุมัติการเทียบโอน", s1);
            AcademicPetition p2 = new AcademicPetition("PET-2567-002", "คำร้องขอเพิ่ม/ถอน", "ขอเพิ่มวิชา CS3103 ล่าช้า", "ขอเพิ่มวิชา CS3103 เนื่องจากระบบโควต้าเต็มในรอบปกติ", "course_add_request.pdf", LocalDateTime.now().minusHours(5), "PENDING", null, s1);
            AcademicPetition p3 = new AcademicPetition("PET-2567-003", "คำร้องทั่วไป", "ขอเปิดวิชา CS3301 กรณีพิเศษ", "ขอเปิดวิชา CS3301 Advance Computer Networks ภาคเรียนฤดูร้อน", "student_signatures.pdf", LocalDateTime.now().minusDays(5), "IN_REVIEW", "กำลังเสนอหัวหน้าสาขาพิจารณา", s2);
            List.of(p1, p2, p3).forEach(petitionRepository::save);

            log.info("Database seeding completed successfully.");
        }
    }

    private Student createStudent(String id, String nameTh, String nameEn, Integer year, Double gpa,
                                  String status, String careerPath, String employmentStatus,
                                  String companyName, String salaryRange, Advisor advisor) {
        Student s = new Student();
        s.setStudentId(id);
        s.setNameTh(nameTh);
        s.setNameEn(nameEn);
        s.setYear(year);
        s.setGpa(gpa);
        s.setStatus(status);
        s.setCareerPath(careerPath);
        s.setEmploymentStatus(employmentStatus);
        s.setCompanyName(companyName);
        s.setSalaryRange(salaryRange);
        s.setAdvisor(advisor);
        return s;
    }
}
