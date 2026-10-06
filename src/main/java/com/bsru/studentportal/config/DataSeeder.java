package com.bsru.studentportal.config;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.GraduationAudit;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.RegistrationPeriod;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ClassSectionRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.RegistrationPeriodRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.GraduationAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class DataSeeder implements CommandLineRunner {

    private final AdvisorRepository advisorRepository;
    private final StudentRepository studentRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final CourseGradeRepository courseGradeRepository;
    private final GraduationProgressRepository graduationProgressRepository;
    private final GraduationAuditRepository graduationAuditRepository;
    private final GraduationAuditService graduationAuditService;
    private final AccountService accountService;
    private final ClassSectionRepository classSectionRepository;
    private final SectionEnrollmentRepository sectionEnrollmentRepository;
    private final RegistrationPeriodRepository registrationPeriodRepository;

    @Override
    public void run(String... args) {
        if (advisorRepository.count() == 0) {
            log.info("Seeding initial Advisors, Students, and Petitions...");

            Advisor adv1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย ใจดี", "Asst. Prof. Dr. Somchai Jaidee", "somchai.j@bsru.ac.th", "081-234-5678", "สาขาวิทยาการคอมพิวเตอร์");
            Advisor adv2 = new Advisor("ADV-02", "ดร.สุดา สวยงาม", "Dr. Suda Suayngam", "suda.s@bsru.ac.th", "082-345-6789", "สาขาวิทยาการคอมพิวเตอร์");
            Advisor adv3 = new Advisor("ADV-03", "ศ.ดร.อนันต์ ยอดเยี่ยม", "Prof. Dr. Anan Yodyeam", "anan.y@bsru.ac.th", "083-456-7890", "สาขาวิทยาการคอมพิวเตอร์");
            List.of(adv1, adv2, adv3).forEach(advisorRepository::save);

            Student s1 = createStudent("6421100042", "นายสมชาย ใจดี", "Mr. Somchai Jaidee", 3, 3.42, "กำลังศึกษา", "Software Engineer", "งานตรงสาย (IT & CS)", "Agoda", "30,000 - 45,000 บาท", adv1);
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

        // Sections are named after the student group (Sec D1/D2) since registration became per-group
        classSectionRepository.findAll().stream().filter(sec -> sec.getSectionNo().matches("\\d+")).forEach(sec -> {
            sec.setSectionNo("D" + sec.getSectionNo());
            classSectionRepository.save(sec);
        });

        // Separate guards: databases seeded before these tables existed still get the academic records
        studentRepository.findById(CurrentUser.DEMO_STUDENT_ID).ifPresent(s -> {
            if (courseGradeRepository.count() == 0) seedCourseGrades(s);
            if (!graduationProgressRepository.existsById(s.getStudentId())) seedGraduationProgress(s);
            if (classSectionRepository.count() == 0) seedTimetable(s);
        });
        seedSampleAtRiskStudent();
        seedLegacySamples();
        seedGraduationAudits();
        graduationAuditService.syncAllProfileGpas();
        fillProfileDefaults();
        accountService.ensureAccounts();

        // One-time sample: until any course besides the original CS3402 has a D2, give every D1-only course a D2
        long d2Count = classSectionRepository.findAll().stream().filter(sec -> "D2".equals(sec.getSectionNo())).count();
        if (d2Count <= 1) seedSampleD2Sections();
    }

    /**
     * Class sections for every course in course_grades (same codes and names, so the timetable and
     * the grades agree), plus a few extra sections students can add while registration is open.
     */
    private void seedTimetable(Student s) {
        log.info("Seeding class sections, enrollments and registration period...");
        Advisor somchai = advisorRepository.findById("ADV-01").orElse(null);
        Advisor suda = advisorRepository.findById("ADV-02").orElse(null);
        Advisor anan = advisorRepository.findById("ADV-03").orElse(null);

        List<ClassSection> enrolled = classSectionRepository.saveAll(List.of(
                // 2/2566
                section(2566, 2, "CS2301", "ระบบฐานข้อมูล", 3, "D1", 1, "09:00", "12:00", "CS-Lab2", somchai, 40),
                section(2566, 2, "CS2302", "การเขียนโปรแกรมเว็บ", 3, "D1", 2, "09:00", "12:00", "CS-Lab3", suda, 40),
                section(2566, 2, "CS2303", "ระบบจัดการฐานข้อมูล (Lab)", 1, "D1", 1, "13:00", "15:00", "CS-Lab2", somchai, 40),
                section(2566, 2, "CS2401", "วิศวกรรมความต้องการ", 3, "D1", 3, "13:00", "16:00", "CS-205", anan, 45),
                section(2566, 2, "MA2101", "สถิติสำหรับวิทยาการคอมพิวเตอร์", 3, "D1", 0, "13:00", "16:00", "SC-201", suda, 60),
                section(2566, 2, "GE1301", "จิตวิทยาทั่วไป", 3, "D1", 4, "09:00", "12:00", "LA-301", null, 80),
                // 1/2566
                section(2566, 1, "CS2101", "โครงสร้างข้อมูล", 3, "D1", 0, "09:00", "12:00", "CS-301", anan, 45),
                section(2566, 1, "CS2102", "การวิเคราะห์อัลกอริทึม", 3, "D1", 0, "13:00", "16:00", "CS-205", anan, 45),
                section(2566, 1, "CS2201", "สถาปัตยกรรมคอมพิวเตอร์", 3, "D1", 1, "09:00", "12:00", "CS-Lab2", somchai, 40),
                section(2566, 1, "CS2103", "ระบบปฏิบัติการ", 3, "D1", 3, "09:00", "12:00", "CS-Lab1", suda, 40),
                section(2566, 1, "GE1201", "คณิตศาสตร์ดิสครีต", 3, "D1", 4, "09:00", "12:00", "SC-105", null, 60),
                section(2566, 1, "GE1102", "ภาษาอังกฤษเพื่อการสื่อสาร", 3, "D1", 2, "13:00", "16:00", "LA-402", null, 50),
                // 2/2565 (grades not released yet)
                section(2565, 2, "CS3101", "ปัญญาประดิษฐ์", 3, "D1", 0, "09:00", "12:00", "CS-Lab1", anan, 40),
                section(2565, 2, "CS3102", "วิศวกรรมซอฟต์แวร์", 3, "D1", 1, "13:00", "16:00", "CS-205", anan, 45),
                section(2565, 2, "CS3201", "ระบบฐานข้อมูลขั้นสูง", 3, "D1", 2, "09:00", "12:00", "CS-Lab2", somchai, 40),
                section(2565, 2, "CS3301", "เครือข่ายคอมพิวเตอร์", 3, "D1", 3, "09:00", "12:00", "CS-Lab3", suda, 40),
                section(2565, 2, "CS3103", "การพัฒนาเว็บแอปพลิเคชัน", 3, "D1", 4, "13:00", "16:00", "CS-Lab3", suda, 40),
                section(2565, 2, "GE2301", "ภาษาอังกฤษเชิงวิชาการ", 3, "D1", 4, "09:00", "12:00", "LA-402", null, 50)));
        enrolled.forEach(sec -> sectionEnrollmentRepository.save(new SectionEnrollment(null, s, sec, LocalDateTime.now(),
                SectionEnrollment.EnrollmentStatus.CONFIRMED, null)));

        // Open for students to add during registration; CS3402 section 1 clashes with CS3101 on purpose
        classSectionRepository.saveAll(List.of(
                section(2565, 2, "CS3401", "การเรียนรู้ของเครื่อง", 3, "D1", 2, "13:00", "16:00", "CS-Lab1", anan, 40),
                section(2565, 2, "CS3402", "การประมวลผลภาษาธรรมชาติ", 3, "D1", 0, "09:00", "12:00", "CS-301", somchai, 35),
                section(2565, 2, "CS3402", "การประมวลผลภาษาธรรมชาติ", 3, "D2", 3, "13:00", "16:00", "CS-301", somchai, 35)));

        // Closed until an admin opens it from the admin page
        RegistrationPeriod period = new RegistrationPeriod();
        period.setAcademicYear(2565);
        period.setTerm(2);
        period.setOpensAt(LocalDateTime.now().minusDays(1).withHour(8).withMinute(0).withSecond(0).withNano(0));
        period.setClosesAt(LocalDateTime.now().plusDays(14).withHour(23).withMinute(59).withSecond(0).withNano(0));
        period.setForceClosed(true);
        registrationPeriodRepository.save(period);
    }

    private ClassSection section(int year, int term, String code, String name, int credits, String sectionNo,
                                 int day, String start, String end, String room, Advisor teacher, Integer capacity) {
        return new ClassSection(null, year, term, code, name, credits, sectionNo, day,
                LocalTime.parse(start), LocalTime.parse(end), room, teacher, capacity,
                ClassSection.ApprovalStatus.APPROVED, null);
    }

    /** Same courses as MOCK_GRADES in js/roles/student.js, which the grades page falls back to offline */
    private void seedCourseGrades(Student s) {
        log.info("Seeding course grades for {}...", s.getStudentId());
        List<CourseGrade> grades = List.of(
                grade(s, 2566, 2, "CS2301", "ระบบฐานข้อมูล", 3, "A", 4.0),
                grade(s, 2566, 2, "CS2302", "การเขียนโปรแกรมเว็บ", 3, "A", 4.0),
                grade(s, 2566, 2, "CS2303", "ระบบจัดการฐานข้อมูล (Lab)", 1, "A", 4.0),
                grade(s, 2566, 2, "CS2401", "วิศวกรรมความต้องการ", 3, "B+", 3.5),
                grade(s, 2566, 2, "MA2101", "สถิติสำหรับวิทยาการคอมพิวเตอร์", 3, "B", 3.0),
                grade(s, 2566, 2, "GE1301", "จิตวิทยาทั่วไป", 3, "A", 4.0),
                grade(s, 2566, 1, "CS2101", "โครงสร้างข้อมูล", 3, "A", 4.0),
                grade(s, 2566, 1, "CS2102", "การวิเคราะห์อัลกอริทึม", 3, "B+", 3.5),
                grade(s, 2566, 1, "CS2201", "สถาปัตยกรรมคอมพิวเตอร์", 3, "A", 4.0),
                grade(s, 2566, 1, "CS2103", "ระบบปฏิบัติการ", 3, "B+", 3.5),
                grade(s, 2566, 1, "GE1201", "คณิตศาสตร์ดิสครีต", 3, "B", 3.0),
                grade(s, 2566, 1, "GE1102", "ภาษาอังกฤษเพื่อการสื่อสาร", 3, "A", 4.0),
                // Results not released yet
                grade(s, 2565, 2, "CS3101", "ปัญญาประดิษฐ์", 3, null, null),
                grade(s, 2565, 2, "CS3102", "วิศวกรรมซอฟต์แวร์", 3, null, null),
                grade(s, 2565, 2, "CS3201", "ระบบฐานข้อมูลขั้นสูง", 3, null, null),
                grade(s, 2565, 2, "CS3301", "เครือข่ายคอมพิวเตอร์", 3, null, null),
                grade(s, 2565, 2, "CS3103", "การพัฒนาเว็บแอปพลิเคชัน", 3, null, null),
                grade(s, 2565, 2, "GE2301", "ภาษาอังกฤษเชิงวิชาการ", 3, null, null));
        courseGradeRepository.saveAll(grades);
    }

    /**
     * The old demo list (39 students in batches 61–66, 5 advisors) as simulated students: basic data only,
     * no grades / audit / login. ADV001's students go to ADV-01, ADV002–005 become ADV-04..07.
     * Runs once (while ADV-04 does not exist), so simulated students an admin deleted do not come back.
     */
    private void seedLegacySamples() {
        if (advisorRepository.existsById("ADV-04")) return;
        var resource = new org.springframework.core.io.ClassPathResource("sample/legacy-students.json");
        if (!resource.exists()) return;
        try (InputStream in = resource.getInputStream()) {
            var root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(in);
            for (var a : root.path("advisors")) {
                advisorRepository.save(new Advisor(a.path("id").asText(), a.path("nameTh").asText(), a.path("nameEn").asText(),
                        a.path("email").asText(), a.path("phone").asText(), a.path("department").asText()));
            }
            int count = 0;
            for (var j : root.path("students")) {
                String id = j.path("studentId").asText();
                if (studentRepository.existsById(id)) continue;
                Student s = createStudent(id, j.path("nameTh").asText(), j.path("nameEn").asText(), j.path("year").asInt(),
                        j.path("gpa").asDouble(), j.path("status").asText(),
                        j.hasNonNull("careerPath") ? j.path("careerPath").asText() : null, null, null, null,
                        advisorRepository.findById(j.path("advisorId").asText()).orElse(null));
                s.setSimulated(true);
                studentRepository.save(s);
                count++;
            }
            log.info("Seeded {} simulated students from the old demo list", count);
        } catch (IOException e) {
            log.warn("Could not read legacy sample students: {}", e.getMessage());
        }
    }

    /** Fixed sample profile details (the web page used to make up a new birthday and phone on every visit) */
    private static final Map<String, String[]> SAMPLE_PROFILES = Map.of(
            // studentId -> email, phone, birth date (ISO), religion, address
            "6421100042", new String[]{"somchai.j@bsru.ac.th", "0812345678", "2003-04-07", "พุทธ", "123 ถ.อิสรภาพ แขวงหิรัญรูจี เขตธนบุรี กรุงเทพฯ 10600"},
            "6421100015", new String[]{"wiphada.k@bsru.ac.th", "0823456789", "2003-08-15", "พุทธ", "45/12 ถ.จรัญสนิทวงศ์ แขวงบางยี่ขัน เขตบางพลัด กรุงเทพฯ 10700"},
            "6521100088", new String[]{"kittisak.p@bsru.ac.th", "0834567890", "2004-01-22", "พุทธ", "88 ถ.เพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพฯ 10160"},
            "6621100003", new String[]{"kanrawee.c@bsru.ac.th", "0845678901", "2005-06-03", "คริสต์", "9 ซ.วุฒากาศ 12 แขวงตลาดพลู เขตธนบุรี กรุงเทพฯ 10600"},
            "6521100120", new String[]{"thanaphon.m@bsru.ac.th", "0856789012", "2004-11-30", "พุทธ", "120 ถ.ราชพฤกษ์ แขวงบางจาก เขตภาษีเจริญ กรุงเทพฯ 10160"});

    /** Profile fields for students that do not have them yet (faculty, admission year, contact details) */
    private void fillProfileDefaults() {
        for (Student s : studentRepository.findAll()) {
            boolean changed = false;
            if (s.getFaculty() == null) { s.setFaculty("คณะวิทยาศาสตร์และเทคโนโลยี"); changed = true; }
            if (s.getDepartment() == null) { s.setDepartment("สาขาวิทยาการคอมพิวเตอร์"); changed = true; }
            if (s.getAdmissionYear() == null) { s.setAdmissionYear(2500 + Integer.parseInt(s.getStudentId().substring(0, 2))); changed = true; }
            String[] p = SAMPLE_PROFILES.get(s.getStudentId());
            if (p != null && s.getEmail() == null) {
                s.setEmail(p[0]);
                s.setPhone(p[1]);
                s.setBirthDate(java.time.LocalDate.parse(p[2]));
                s.setReligion(p[3]);
                s.setAddress(p[4]);
                changed = true;
            }
            if (changed) studentRepository.save(s);
        }
    }

    /**
     * Fictional sample advisee of ADV-01 whose grades are falling (F / D, GPA 1.38) and who registered a
     * heavy, clashing timetable, so the advisor risk check has a real case to show.
     * Grades come from graduation/6521100120.json; created once.
     */
    private void seedSampleAtRiskStudent() {
        String id = "6521100120";
        if (studentRepository.existsById(id)) return;
        Advisor advisor = advisorRepository.findById(CurrentUser.DEMO_ADVISOR_ID).orElse(null);
        if (advisor == null) return;
        Student s = createStudent(id, "นายธนพล มุ่งมั่น", "Mr. Thanaphon Mungman", 2, 1.38, "กำลังศึกษา",
                null, null, null, null, advisor);
        studentRepository.save(s);
        List<String> heavyLoad = List.of("CS3101", "CS3402", "CS3102", "CS3201", "CS3301", "CS3103", "GE2301");
        classSectionRepository.findByAcademicYearAndTermOrderByCourseCodeAscSectionNoAsc(2565, 2).stream()
                .filter(sec -> "D1".equals(sec.getSectionNo()) && heavyLoad.contains(sec.getCourseCode()))
                .forEach(sec -> sectionEnrollmentRepository.save(new SectionEnrollment(null, s, sec, LocalDateTime.now(),
                        SectionEnrollment.EnrollmentStatus.CONFIRMED, null)));
        log.info("Seeded sample at-risk student {}", id);
    }

    /**
     * Graduation audit sheets from src/main/resources/graduation/&lt;studentId&gt;.json, one file per student.
     * Loaded only for students that exist and have no sheet yet, so sheets an admin uploaded later are kept.
     */
    private void seedGraduationAudits() {
        Resource[] files;
        try {
            files = new PathMatchingResourcePatternResolver().getResources("classpath:graduation/*.json");
        } catch (IOException e) {
            log.warn("Could not list graduation audit files: {}", e.getMessage());
            return;
        }
        for (Resource file : files) {
            String studentId = Objects.requireNonNull(file.getFilename()).replace(".json", "");
            if (!studentRepository.existsById(studentId) || graduationAuditRepository.existsById(studentId)) continue;
            try (InputStream in = file.getInputStream()) {
                graduationAuditRepository.save(new GraduationAudit(studentId, new String(in.readAllBytes(), StandardCharsets.UTF_8)));
                log.info("Seeded graduation audit for {}", studentId);
            } catch (IOException e) {
                log.warn("Could not read graduation audit for {}: {}", studentId, e.getMessage());
            }
        }
    }

    /** Same numbers as MOCK_GRADUATION in js/roles/student.js */

    private void seedGraduationProgress(Student s) {
        log.info("Seeding graduation progress for {}...", s.getStudentId());
        GraduationProgress g = new GraduationProgress();
        g.setStudentId(s.getStudentId());
        g.setCoreRequired(72);
        g.setCoreEarned(54);
        g.setGeRequired(30);
        g.setGeEarned(24);
        g.setElectiveRequired(18);
        g.setElectiveEarned(12);
        g.setFreeRequired(12);
        g.setFreeEarned(6);
        g.setGpaRequired(2.0);
        g.setActivityRequired(6);
        g.setActivityCompleted(4);
        g.setStatus("กำลังดำเนินการ");
        graduationProgressRepository.save(g);
    }

    private CourseGrade grade(Student s, int year, int term, String code, String name,
                              int credits, String grade, Double point) {
        return new CourseGrade(null, s, year, term, code, name, credits, grade, point);
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
    /**
     * Sample Sec D2 for every course that only has D1. Each D2 keeps the D1 length, room, teacher and
     * seats, and gets the first slot (Mon-Fri, 09:00 or 13:00) where the teacher is free, the room is
     * free and it does not clash with another D2 of the same semester, so a D2 student who takes every
     * course still gets a clash-free timetable.
     */
    private void seedSampleD2Sections() {
        List<ClassSection> all = classSectionRepository.findAll();
        Map<String, List<ClassSection>> byTerm = all.stream()
                .collect(Collectors.groupingBy(sec -> sec.getAcademicYear() + "/" + sec.getTerm()));
        int created = 0;
        for (List<ClassSection> term : byTerm.values()) {
            List<ClassSection> placed = new ArrayList<>(term);
            Set<String> hasD2 = term.stream().filter(sec -> "D2".equals(sec.getSectionNo()))
                    .map(ClassSection::getCourseCode).collect(Collectors.toSet());
            List<ClassSection> d1Only = term.stream()
                    .filter(sec -> "D1".equals(sec.getSectionNo()) && !hasD2.contains(sec.getCourseCode()))
                    .sorted(Comparator.comparing(ClassSection::getDayOfWeek).thenComparing(ClassSection::getStartTime))
                    .toList();
            for (ClassSection d1 : d1Only) {
                ClassSection d2 = findD2Slot(d1, placed);
                if (d2 == null) {
                    log.warn("No free slot for sample D2 of {} {}/{}", d1.getCourseCode(), d1.getTerm(), d1.getAcademicYear());
                    continue;
                }
                placed.add(classSectionRepository.save(d2));
                created++;
            }
        }
        log.info("Seeded {} sample Sec D2 sections", created);
    }

    private ClassSection findD2Slot(ClassSection d1, List<ClassSection> placed) {
        Duration length = Duration.between(d1.getStartTime(), d1.getEndTime());
        LocalTime other = d1.getStartTime().isBefore(LocalTime.NOON) ? LocalTime.of(13, 0) : LocalTime.of(9, 0);
        for (int offset = 0; offset < 5; offset++) {
            int day = (d1.getDayOfWeek() + offset) % 5;
            for (LocalTime start : offset == 0 ? List.of(other) : List.of(d1.getStartTime(), other)) {
                ClassSection d2 = new ClassSection(null, d1.getAcademicYear(), d1.getTerm(), d1.getCourseCode(),
                        d1.getCourseName(), d1.getCredits(), "D2", day, start, start.plus(length), d1.getRoom(),
                        d1.getInstructor(), d1.getCapacity(), ClassSection.ApprovalStatus.APPROVED, null);
                boolean free = placed.stream().noneMatch(o -> overlaps(d2, o) && (
                        "D2".equals(o.getSectionNo())
                        || (d2.getInstructor() != null && o.getInstructor() != null
                            && d2.getInstructor().getId().equals(o.getInstructor().getId()))
                        || (d2.getRoom() != null && d2.getRoom().equalsIgnoreCase(o.getRoom()))));
                if (free) return d2;
            }
        }
        return null;
    }

    private static boolean overlaps(ClassSection a, ClassSection b) {
        return Objects.equals(a.getDayOfWeek(), b.getDayOfWeek())
                && a.getStartTime().isBefore(b.getEndTime()) && b.getStartTime().isBefore(a.getEndTime());
    }
}
