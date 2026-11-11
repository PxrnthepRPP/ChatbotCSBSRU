package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.StudentProfileRequest;
import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Admin management of student records in the database (the "จัดการนักศึกษา" page). */
@Service
@RequiredArgsConstructor
public class StudentAdminService {

    public static final List<String> STATUSES = List.of("กำลังศึกษา", "จบการศึกษา", "พักการศึกษา", "พ้นสภาพ");

    @Getter
    public static class StudentAdminException extends RuntimeException {
        private final HttpStatus status;

        public StudentAdminException(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }
    }

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AcademicPetitionRepository petitionRepository;
    private final CourseGradeRepository courseGradeRepository;
    private final GraduationProgressRepository graduationProgressRepository;
    private final GraduationAuditRepository graduationAuditRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final AccountService accountService;
    private final CohortAdvisorService cohortAdvisorService;
    private final com.bsru.studentportal.repository.InstructorGradeRepository instructorGradeRepository;

    @Transactional
    public Student create(StudentRequest req) {
        String id = req.getStudentId() == null ? "" : req.getStudentId().trim();
        if (!id.matches("\\d{10}")) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก");
        }
        if (studentRepository.existsById(id)) {
            throw new StudentAdminException(HttpStatus.CONFLICT, "มีนักศึกษารหัส " + id + " ในระบบแล้ว");
        }
        Student s = new Student();
        s.setStudentId(id);
        s.setYear(1);
        s.setGpa(0.0);
        s.setStatus(STATUSES.get(0));
        s.setSimulated(Boolean.TRUE.equals(req.getSimulated()));
        s.setAdmissionYear(2500 + Integer.parseInt(id.substring(0, 2)));
        apply(s, req);
        applyCohortAdvisor(s);
        if (isBlank(s.getNameTh())) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "กรุณากรอกชื่อ-สกุล (ไทย)");
        }
        if (isBlank(s.getNameEn())) s.setNameEn(s.getNameTh());
        // Real students log in, and their first password is built from the national ID
        if (!s.isSimulated() && s.getNationalId() == null) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "กรุณากรอกเลขบัตรประชาชน 13 หลัก");
        }
        s.setFaculty("คณะวิทยาศาสตร์และเทคโนโลยี");
        s.setDepartment("สาขาวิทยาการคอมพิวเตอร์");
        Student saved = studentRepository.save(s);
        // Login account for real students: username = student id, first password = initials + national ID
        // (e.g. SJ1101700203450), must be changed at the first login. Sent back once so the admin can hand it over.
        if (!saved.isSimulated()) saved.setInitialPassword(accountService.createStudentAccount(id));
        return saved;
    }

    /** An advisor adds a sample (simulated) student to their own advisees */
    @Transactional
    public Student createSimulatedForAdvisor(String advisorId, StudentRequest req) {
        req.setSimulated(true);
        req.setAdvisorId(advisorId);
        return create(req);
    }

    /** An advisor may delete only simulated students they advise; real student records stay with the admin */
    @Transactional
    public void deleteSimulatedForAdvisor(String advisorId, String studentId) {
        Student s = studentRepository.findById(studentId)
                .orElseThrow(() -> new StudentAdminException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId));
        if (s.getAdvisor() == null || !advisorId.equals(s.getAdvisor().getId())) {
            throw new StudentAdminException(HttpStatus.FORBIDDEN, "นักศึกษาคนนี้ไม่ได้อยู่ในความดูแลของคุณ");
        }
        if (!s.isSimulated()) {
            throw new StudentAdminException(HttpStatus.FORBIDDEN, "อาจารย์ลบได้เฉพาะข้อมูลจำลอง ข้อมูลนักศึกษาจริงต้องให้ผู้ดูแลระบบลบ");
        }
        delete(studentId);
    }

    @Transactional
    public Student update(String studentId, StudentRequest req) {
        Student s = studentRepository.findById(studentId)
                .orElseThrow(() -> new StudentAdminException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId));
        apply(s, req);
        applyCohortAdvisor(s);
        if (isBlank(s.getNameTh())) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "กรุณากรอกชื่อ-สกุล (ไทย)");
        }
        return studentRepository.save(s);
    }

    /** The student's own profile page (also usable by an admin). Same checks as the web form. */
    @Transactional
    public Student updateProfile(String studentId, StudentProfileRequest req) {
        Student s = studentRepository.findById(studentId)
                .orElseThrow(() -> new StudentAdminException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId));
        if (req.getNameTh() != null) {
            if (!req.getNameTh().trim().matches("[\\u0E00-\\u0E7F\\s.]+")) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ชื่อ-สกุล (ภาษาไทย) ต้องเป็นตัวอักษรภาษาไทยเท่านั้น");
            }
            s.setNameTh(req.getNameTh().trim());
        }
        if (req.getNameEn() != null) {
            if (!req.getNameEn().trim().matches("[A-Za-z\\s.]+")) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ชื่อ-สกุล (English) ต้องเป็นตัวอักษรภาษาอังกฤษเท่านั้น");
            }
            s.setNameEn(req.getNameEn().trim());
        }
        if (req.getEmail() != null) {
            if (!req.getEmail().trim().matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "รูปแบบอีเมลไม่ถูกต้อง");
            }
            s.setEmail(req.getEmail().trim());
        }
        if (req.getPhone() != null) {
            if (!req.getPhone().trim().matches("0\\d{9}")) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0");
            }
            s.setPhone(req.getPhone().trim());
        }
        if (req.getBirthDate() != null && !req.getBirthDate().isBlank()) {
            try {
                LocalDate birth = LocalDate.parse(req.getBirthDate().trim());
                if (birth.isAfter(LocalDate.now())) throw new StudentAdminException(HttpStatus.BAD_REQUEST, "วันเกิดต้องไม่เป็นวันในอนาคต");
                s.setBirthDate(birth);
            } catch (DateTimeParseException e) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "วันเกิดต้องอยู่ในรูปแบบ yyyy-MM-dd");
            }
        }
        if (req.getReligion() != null) s.setReligion(blankToNull(req.getReligion()));
        if (req.getAddress() != null) s.setAddress(blankToNull(req.getAddress()));
        return studentRepository.save(s);
    }

    /** Removes the student and everything that belongs to them (grades, registrations, petitions, audits) */
    @Transactional
    public void delete(String studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new StudentAdminException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId);
        }
        instructorGradeRepository.deleteAll(instructorGradeRepository.findByStudentStudentId(studentId));
        enrollmentRepository.deleteAll(enrollmentRepository.findByStudentStudentId(studentId));
        courseGradeRepository.deleteAll(courseGradeRepository.findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId));
        petitionRepository.deleteAll(petitionRepository.findByStudentStudentId(studentId));
        graduationProgressRepository.deleteById(studentId);
        graduationAuditRepository.deleteById(studentId);
        studentRepository.deleteById(studentId);
        accountService.deleteAccount(studentId);
    }

    private void apply(Student s, StudentRequest req) {
        // Blank = keep the number already recorded (the edit form never receives the full number)
        String nationalId = NationalId.normalize(req.getNationalId());
        if (!isBlank(nationalId)) {
            String problem = NationalId.problem(nationalId);
            if (problem != null) throw new StudentAdminException(HttpStatus.BAD_REQUEST, problem);
            if (studentRepository.existsByNationalIdAndStudentIdNot(nationalId, s.getStudentId())) {
                throw new StudentAdminException(HttpStatus.CONFLICT, "เลขบัตรประชาชนนี้ถูกใช้กับนักศึกษาคนอื่นในระบบแล้ว");
            }
            s.setNationalId(nationalId);
        }
        if (req.getNameTh() != null) s.setNameTh(req.getNameTh().trim());
        if (req.getNameEn() != null) s.setNameEn(req.getNameEn().trim());
        if (req.getYear() != null) {
            if (req.getYear() < 1 || req.getYear() > 8) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ชั้นปีต้องอยู่ระหว่าง 1–8");
            }
            s.setYear(req.getYear());
        }
        if (req.getGpa() != null) {
            if (req.getGpa() < 0 || req.getGpa() > 4) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "GPA ต้องอยู่ระหว่าง 0.00–4.00");
            }
            s.setGpa(req.getGpa());
        }
        if (req.getStatus() != null) {
            if (!STATUSES.contains(req.getStatus())) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "สถานะต้องเป็น " + String.join(", ", STATUSES));
            }
            s.setStatus(req.getStatus());
        }
        if (req.getAdvisorId() != null && !s.isSimulated()) {
            // Real students get their cohort's advisor (applyCohortAdvisor); another advisor is a mistake
            String cohortAdvisor = cohortAdvisorService.advisorOfCohort(CohortAdvisorService.cohortOf(s))
                    .map(a -> a.getId()).orElse(null);
            if (!req.getAdvisorId().isBlank() && !req.getAdvisorId().equals(cohortAdvisor)) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "อาจารย์ที่ปรึกษาของนักศึกษากำหนดตามรุ่น (รุ่น "
                        + CohortAdvisorService.cohortOf(s) + ") เปลี่ยนได้ที่การ์ด \"อาจารย์ที่ปรึกษาประจำรุ่น\" ในหน้าจัดการอาจารย์");
            }
        } else if (req.getAdvisorId() != null) {
            s.setAdvisor(req.getAdvisorId().isBlank() ? null : advisorRepository.findById(req.getAdvisorId())
                    .orElseThrow(() -> new StudentAdminException(HttpStatus.BAD_REQUEST, "ไม่พบอาจารย์รหัส " + req.getAdvisorId())));
        }
        if (req.getStudentSection() != null) {
            String group = req.getStudentSection().trim().toUpperCase();
            if (!TimetableService.STUDENT_GROUPS.contains(group)) {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "Sec ต้องเป็น D1 หรือ D2");
            }
            s.setStudentSection(group);
        }
        if (req.getCareerPath() != null) s.setCareerPath(blankToNull(req.getCareerPath()));
        if (req.getEmploymentStatus() != null) s.setEmploymentStatus(blankToNull(req.getEmploymentStatus()));
        if (req.getCompanyName() != null) s.setCompanyName(blankToNull(req.getCompanyName()));
        if (req.getSalaryRange() != null) s.setSalaryRange(blankToNull(req.getSalaryRange()));
    }

    /** A real student's advisor is always the advisor of their cohort (none until the admin sets one) */
    private void applyCohortAdvisor(Student s) {
        if (s.isSimulated()) return;
        s.setAdvisor(cohortAdvisorService.advisorOfCohort(CohortAdvisorService.cohortOf(s)).orElse(null));
    }

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static String blankToNull(String v) {
        return v.isBlank() ? null : v.trim();
    }
}
