package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.ActivityRegisterRequest;
import com.bsru.studentportal.model.GraduationProgress;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.model.StudentActivity;
import com.bsru.studentportal.repository.GraduationProgressRepository;
import com.bsru.studentportal.repository.StudentActivityRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class StudentActivityService {

    private final StudentActivityRepository activityRepository;
    private final StudentRepository studentRepository;
    private final GraduationProgressRepository progressRepository;

    public record ActivityCriterion(
            String id,
            String name,
            String group,
            int minRequired,
            int minYear,
            boolean finalYearOnly,
            boolean isPublicMind
    ) {}

    public static final List<ActivityCriterion> BSRU_CRITERIA = List.of(
            new ActivityCriterion("uni-orient", "ปฐมนิเทศรวม", "มหาวิทยาลัย", 1, 1, false, false),
            new ActivityCriterion("piralai", "วันพิราลัย", "มหาวิทยาลัย", 1, 1, false, false),
            new ActivityCriterion("rajabhat-day", "วันสถาปนา ราชภัฏ", "มหาวิทยาลัย", 1, 1, false, false),
            new ActivityCriterion("public-mind", "จิตสาธารณะ", "จิตสาธารณะ/ชมรม", 2, 1, false, true),
            new ActivityCriterion("club", "ชมรม/ชุมนุม", "จิตสาธารณะ/ชมรม", 3, 1, false, false),
            new ActivityCriterion("uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", 10, 1, false, false),
            new ActivityCriterion("life-skill-y2", "อบรมทักษะชีวิต ชั้นปี 2", "ทักษะชีวิตและคุณธรรม", 1, 2, false, false),
            new ActivityCriterion("ethics", "อบรมคุณธรรมจริยธรรม", "ทักษะชีวิตและคุณธรรม", 1, 1, false, false),
            new ActivityCriterion("life-skill-y3", "อบรมทักษะชีวิต ชั้นปี 3", "ทักษะชีวิตและคุณธรรม", 1, 3, false, false),
            new ActivityCriterion("digital-work", "พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน", "ทักษะดิจิทัล", 1, 3, false, false),
            new ActivityCriterion("fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", 5, 1, false, false),
            new ActivityCriterion("fac-orient", "ปฐมนิเทศคณะ", "คณะ", 1, 1, false, false),
            new ActivityCriterion("thonburi-study", "ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา", "มหาวิทยาลัย", 1, 1, false, false),
            new ActivityCriterion("exit-orient", "ปัจฉิมนิเทศ", "ปัจฉิม/ชั้นปีสุดท้าย", 1, 4, true, false),
            new ActivityCriterion("digital-new", "ทักษะดิจิทัลสำหรับนักศึกษาใหม่", "ทักษะดิจิทัล", 1, 1, false, false),
            new ActivityCriterion("digital-final", "ทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้าย", "ทักษะดิจิทัล", 1, 4, true, false),
            new ActivityCriterion("fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", 5, 1, false, false)
    );

    public static final Map<String, ActivityCriterion> CRITERIA_MAP = new LinkedHashMap<>();
    static {
        for (ActivityCriterion c : BSRU_CRITERIA) {
            CRITERIA_MAP.put(c.id(), c);
        }
    }

    /**
     * Get all activities of a student. Seeds default sample baseline if none exist.
     */
    @Transactional
    public List<StudentActivity> getActivities(String studentId) {
        if (!studentRepository.existsById(studentId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId);
        }
        List<StudentActivity> list = activityRepository.findByStudentIdOrderByAcademicYearDescCreatedAtDesc(studentId);
        if (list.isEmpty()) {
            seedBaselineActivities(studentId);
            list = activityRepository.findByStudentIdOrderByAcademicYearDescCreatedAtDesc(studentId);
        }
        return list;
    }

    /**
     * Self-register a new activity by the student.
     */
    @Transactional
    public StudentActivity registerActivity(String studentId, ActivityRegisterRequest req) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบนักศึกษารหัส " + studentId));

        if (req.getActivityCategoryId() == null || req.getActivityCategoryId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาเลือกหัวข้อกิจกรรม");
        }
        ActivityCriterion criterion = CRITERIA_MAP.get(req.getActivityCategoryId().trim());
        if (criterion == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ไม่พบประเภทกิจกรรมที่ระบุ: " + req.getActivityCategoryId());
        }
        if (req.getTitle() == null || req.getTitle().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุชื่อกิจกรรม");
        }
        if (req.getAcademicYear() == null || req.getAcademicYear().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุปีการศึกษา");
        }

        Integer count = req.getCount() != null && req.getCount() > 0 ? req.getCount() : 1;
        Integer hours = null;

        // "ส่วนชั่วโมงให้มีพิเศษสำหรับเฉพาะหัวข้อจิตสาธารณะเท่านั้น"
        if (criterion.isPublicMind()) {
            if (req.getHours() == null || req.getHours() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กิจกรรมหมวดจิตสาธารณะต้องระบุจำนวนชั่วโมง (อย่างน้อย 1 ชั่วโมง)");
            }
            hours = req.getHours();
        }

        // "เมื่อลงเเล้วบันทึกจะเเสดงสถานะผ่านเเต่หัวข้อจะต้องตรงเงื่อนไขเท่านั้นถึงจะผ่านได้"
        int studentYear = getStudentYear(student);
        String status;
        if (studentYear < criterion.minYear()) {
            status = "รอตรวจสอบ (เงื่อนไข: ต้องเป็นนักศึกษาชั้นปีที่ " + criterion.minYear() + " ขึ้นไป)";
        } else if (criterion.finalYearOnly() && studentYear < 4 && !"จบการศึกษา".equals(student.getStatus())) {
            status = "รอตรวจสอบ (เงื่อนไข: สำหรับนักศึกษาชั้นปีสุดท้ายเท่านั้น)";
        } else {
            status = "ผ่าน";
        }

        StudentActivity activity = new StudentActivity();
        activity.setStudentId(studentId);
        activity.setActivityCategoryId(criterion.id());
        activity.setCategoryName(criterion.name());
        activity.setCategoryGroup(criterion.group());
        activity.setTitle(req.getTitle().trim());
        activity.setAcademicYear(req.getAcademicYear().trim());
        activity.setActivityDate(req.getActivityDate() != null && !req.getActivityDate().isBlank() ? req.getActivityDate().trim() : "-");
        activity.setCount(count);
        activity.setHours(hours);
        activity.setStatus(status);
        activity.setCreatedAt(LocalDateTime.now());

        StudentActivity saved = activityRepository.save(activity);
        syncGraduationProgress(studentId);
        log.info("Student {} registered activity '{}' ({}) with status '{}'", studentId, saved.getTitle(), saved.getCategoryName(), saved.getStatus());
        return saved;
    }

    /**
     * Delete an activity registered by student.
     */
    @Transactional
    public void deleteActivity(String studentId, Long activityId) {
        StudentActivity act = activityRepository.findById(activityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบกิจกรรมรหัส " + activityId));
        if (!act.getStudentId().equals(studentId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ไม่สามารถลบกิจกรรมของผู้อื่นได้");
        }
        activityRepository.delete(act);
        syncGraduationProgress(studentId);
        log.info("Student {} deleted activity {}", studentId, activityId);
    }

    /**
     * Recalculate passed categories and update GraduationProgress.
     */
    public void syncGraduationProgress(String studentId) {
        List<StudentActivity> activities = activityRepository.findByStudentIdOrderByAcademicYearDescCreatedAtDesc(studentId);
        Map<String, Integer> counts = new HashMap<>();
        for (StudentActivity a : activities) {
            if ("ผ่าน".equals(a.getStatus())) {
                counts.put(a.getActivityCategoryId(), counts.getOrDefault(a.getActivityCategoryId(), 0) + (a.getCount() != null ? a.getCount() : 1));
            }
        }
        int passedCategories = 0;
        for (ActivityCriterion c : BSRU_CRITERIA) {
            if (counts.getOrDefault(c.id(), 0) >= c.minRequired()) {
                passedCategories++;
            }
        }
        final int passed = passedCategories;
        progressRepository.findById(studentId).ifPresent(p -> {
            p.setActivityCompleted(passed);
            p.setActivityRequired(BSRU_CRITERIA.size());
            progressRepository.save(p);
        });
    }

    /**
     * Generate rich Thai summary of student activities for AI Chatbot (Gemini / Tools).
     */
    @Transactional(readOnly = true)
    public String getActivitySummaryForAi(String studentId) {
        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) {
            return "ไม่พบข้อมูลนักศึกษารหัส " + studentId;
        }
        List<StudentActivity> activities = activityRepository.findByStudentIdOrderByAcademicYearDescCreatedAtDesc(studentId);
        if (activities.isEmpty()) {
            return "นักศึกษา " + student.getNameTh() + " (" + studentId + ") ยังไม่มีประวัติการบันทึกกิจกรรมในระบบ";
        }

        Map<String, Integer> catCounts = new LinkedHashMap<>();
        Map<String, Integer> catHours = new LinkedHashMap<>();
        for (StudentActivity a : activities) {
            if ("ผ่าน".equals(a.getStatus())) {
                catCounts.put(a.getActivityCategoryId(), catCounts.getOrDefault(a.getActivityCategoryId(), 0) + (a.getCount() != null ? a.getCount() : 1));
            }
            if (a.getHours() != null && a.getHours() > 0) {
                catHours.put(a.getActivityCategoryId(), catHours.getOrDefault(a.getActivityCategoryId(), 0) + a.getHours());
            }
        }

        int passedCount = 0;
        List<String> passedList = new ArrayList<>();
        List<String> remainingList = new ArrayList<>();

        for (ActivityCriterion c : BSRU_CRITERIA) {
            int earned = catCounts.getOrDefault(c.id(), 0);
            if (earned >= c.minRequired()) {
                passedCount++;
                passedList.add(c.name() + " (" + earned + "/" + c.minRequired() + " ครั้ง)");
            } else {
                int missing = c.minRequired() - earned;
                remainingList.add(c.name() + " (ทำไปแล้ว " + earned + "/" + c.minRequired() + " ครั้ง, ขาดอีก " + missing + " ครั้ง)");
            }
        }

        int totalHours = catHours.values().stream().mapToInt(Integer::intValue).sum();
        int totalParticipations = activities.stream().mapToInt(a -> a.getCount() != null ? a.getCount() : 1).sum();

        StringBuilder sb = new StringBuilder();
        sb.append("=== สรุปผลการเข้าร่วมกิจกรรมนักศึกษา มบส. (17 ประเภท) ===\n");
        sb.append("นักศึกษา: ").append(student.getNameTh()).append(" (รหัส ").append(studentId).append(")\n");
        sb.append("สถานะภาพรวม: ผ่านเกณฑ์ ").append(passedCount).append(" จาก ").append(BSRU_CRITERIA.size()).append(" ประเภท");
        sb.append(passedCount == BSRU_CRITERIA.size() ? " (🎉 ผ่านเกณฑ์กิจกรรมครบถ้วนแล้ว)\n" : " (⚠️ ยังไม่ครบเกณฑ์)\n");
        sb.append("จำนวนครั้งที่เข้าร่วมทั้งหมด: ").append(totalParticipations).append(" ครั้ง\n");
        sb.append("ชั่วโมงจิตสาธารณะสะสม: ").append(totalHours).append(" ชั่วโมง\n\n");

        if (!remainingList.isEmpty()) {
            sb.append("หมวดที่ยังไม่ผ่านเกณฑ์ (ขาดอีก):\n");
            for (String rem : remainingList) {
                sb.append("- ").append(rem).append("\n");
            }
            sb.append("\n");
        }

        if (!passedList.isEmpty()) {
            sb.append("หมวดที่ผ่านเกณฑ์แล้ว:\n");
            for (String p : passedList) {
                sb.append("✓ ").append(p).append("\n");
            }
            sb.append("\n");
        }

        sb.append("รายการกิจกรรมที่บันทึกไว้ล่าสุด (ตัวอย่าง 6 รายการ):\n");
        int limit = Math.min(6, activities.size());
        for (int i = 0; i < limit; i++) {
            StudentActivity a = activities.get(i);
            sb.append(i + 1).append(". [ปี ").append(a.getAcademicYear()).append("] ").append(a.getTitle())
                    .append(" | หมวด: ").append(a.getCategoryName())
                    .append(a.getHours() != null ? " (" + a.getHours() + " ชม.)" : "")
                    .append(" | สถานะ: ").append(a.getStatus()).append("\n");
        }
        return sb.toString();
    }

    private int getStudentYear(Student student) {
        if (student.getYear() != null && student.getYear() > 0) {
            return student.getYear();
        }
        try {
            int entryYearBE = 2500 + Integer.parseInt(student.getStudentId().substring(0, 2));
            int currentYearBE = 2568; // Academic year context
            return Math.max(1, Math.min(4, currentYearBE - entryYearBE + 1));
        } catch (Exception e) {
            return 3;
        }
    }

    private void seedBaselineActivities(String studentId) {
        List<StudentActivity> initial = new ArrayList<>();
        // uni-orient
        initial.add(createAct(studentId, "uni-orient", "ปฐมนิเทศรวม", "มหาวิทยาลัย", "ปฐมนิเทศนักศึกษาใหม่ ประจำปีการศึกษา 2566", "2566", "1/7/2566", 1, null, "ผ่าน"));
        // piralai
        initial.add(createAct(studentId, "piralai", "วันพิราลัย", "มหาวิทยาลัย", "วันคล้ายวันพิราลัย พ.ศ. 2567", "2566", "19/1/2567", 1, null, "ผ่าน"));
        // rajabhat-day
        initial.add(createAct(studentId, "rajabhat-day", "วันสถาปนา ราชภัฏ", "มหาวิทยาลัย", "พิธีอัญเชิญตราราชภัฏ (วันสถาปนาราชภัฏ)", "2566", "14/2/2567", 1, null, "ผ่าน"));
        // public-mind
        initial.add(createAct(studentId, "public-mind", "จิตสาธารณะ", "จิตสาธารณะ/ชมรม", "บริจาคโลหิตช่วยเหลือชีวิต สร้างจิตสำนึกการเป็นผู้ให้ ครั้งที่ 26 (ผ่าน)", "2566", "27/9/2566", 1, 6, "ผ่าน"));
        initial.add(createAct(studentId, "public-mind", "จิตสาธารณะ", "จิตสาธารณะ/ชมรม", "จิตอาสา-Big Cleaning Day ติดตาม 'ราชภัฏเพื่อการพัฒนา สู่ท้องถิ่น'", "2566", "31/10/2566", 1, 3, "ผ่าน"));
        initial.add(createAct(studentId, "public-mind", "จิตสาธารณะ", "จิตสาธารณะ/ชมรม", "การเปิดสนามกีฬาเพื่อการแข่งขันกีฬาสร้างความสามัคคี", "2566", "30/11/2566", 1, 3, "ผ่าน"));
        initial.add(createAct(studentId, "public-mind", "จิตสาธารณะ", "จิตสาธารณะ/ชมรม", "บริจาคโลหิตช่วยเหลือชีวิต สร้างจิตสำนึกการเป็นผู้ให้ ครั้งที่ 27 (ผ่าน)", "2566", "12/2/2567", 1, 6, "ผ่าน"));
        // club
        initial.add(createAct(studentId, "club", "ชมรม/ชุมนุม", "จิตสาธารณะ/ชมรม", "ชมรม ชีวะออนทัวร์", "2566", "-", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "club", "ชมรม/ชุมนุม", "จิตสาธารณะ/ชมรม", "ชมรม Board Games (บอร์ดเกม)", "2566", "-", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "club", "ชมรม/ชุมนุม", "จิตสาธารณะ/ชมรม", "ชมรม Backup Product 2567", "2567", "-", 1, null, "ผ่าน"));
        // uni-elective
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "บายศรีสู่ขวัญและรับน้องใหม่ ประจำปี 2566", "2566", "15/7/2566", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "การแสดงนิทรรศการและการเสวนาทางวิชาการ วันพิราลัย 2567", "2566", "17/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "การแสดงหน้าเวที อาคาร 1 (18 มกราคม 67)", "2566", "18/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "การแสดงฑูตกิจกรรม [วันพิราลัย]", "2566", "19/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "ประกวดร้องเพลงลูกทุ่ง [วันคล้ายวันพิราลัย]", "2566", "19/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "การประกวดพูดสุนทรพจน์ [วันคล้ายวันพิราลัย]", "2566", "19/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "แข่งขันกีฬาภายในประจำปีการศึกษา 2566 'ชงโคเกมส์ 2024'", "2566", "22/3/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "กิจกรรมที่ ๑ อบรมเชิงปฏิบัติการ 'การเสริมสร้างพลังผู้นำแห่งอนาคต'", "2566", "2/4/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "เรียนรู้เข้าใจใช้เป็น สิทธิ์บัตรทอง", "2566", "3/4/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "เลือกตั้งนายกองค์การนักศึกษา ประจำปีการศึกษา 2567", "2566", "5/4/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "เลือกตั้งนายกองค์การนักศึกษา ประจำปี 2568", "2567", "14/3/2568", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "uni-elective", "กิจกรรมเลือก (มหาวิทยาลัย)", "มหาวิทยาลัย", "โครงการพัฒนาทักษะภาษาอังกฤษเพื่อยกระดับภาษาอังกฤษ CEFR (ออนไลน์)", "2568", "4/3/2569", 1, null, "ผ่าน"));
        // life-skill-y2
        initial.add(createAct(studentId, "life-skill-y2", "อบรมทักษะชีวิต ชั้นปี 2", "ทักษะชีวิตและคุณธรรม", "อบรมทักษะชีวิต นักศึกษา ชั้นปี 2", "2567", "14/12/2567", 1, null, "ผ่าน"));
        // ethics
        initial.add(createAct(studentId, "ethics", "อบรมคุณธรรมจริยธรรม", "ทักษะชีวิตและคุณธรรม", "อบรมคุณธรรมและจริยธรรม", "2566", "5/7/2566", 1, null, "ผ่าน"));
        // life-skill-y3
        initial.add(createAct(studentId, "life-skill-y3", "อบรมทักษะชีวิต ชั้นปี 3", "ทักษะชีวิตและคุณธรรม", "อบรมทักษะชีวิตสำหรับนักศึกษา ชั้นปีที่ 3", "2568", "1/2/2569", 1, null, "ผ่าน"));
        // digital-work
        initial.add(createAct(studentId, "digital-work", "พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน", "ทักษะดิจิทัล", "การพัฒนาและการทดสอบทักษะด้านดิจิทัลสำหรับนักศึกษาชั้นปีที่ 3", "2568", "25/8/2568", 1, null, "ผ่าน"));
        // fac-mandatory
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "พิธีไหว้ครู สืบสานวัฒนธรรมไทย ปีการศึกษา 2566", "2566", "10/8/2566", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "พัฒนาซอฟต์สกิลด้วยกระบวนการวิศวกรสังคม (คณะวิทยาศาสตร์ฯ)", "2566", "16/2/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "ปรับพื้นฐานทางวิชาการคณะวิทยาศาสตร์และเทคโนโลยี", "2566", "16/2/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "[บังคับคณะ] กิจกรรมกีฬาวิทยาศาสตร์และเทคโนโลยีสัมพันธ์", "2566", "4/3/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "เลือกตั้งนายกสโมสรนักศึกษา คณะ ประจำปีการศึกษา 2567", "2566", "5/4/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "กิจกรรมเสริมสร้างสมรรถนะความเป็นครู", "2566", "-", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-mandatory", "กิจกรรมบังคับ (คณะ)", "คณะ", "เลือกตั้งนายกสโมสรนักศึกษาคณะ ประจำปี 2568", "2567", "14/3/2568", 1, null, "ผ่าน"));
        // fac-orient
        initial.add(createAct(studentId, "fac-orient", "ปฐมนิเทศคณะ", "คณะ", "ปฐมนิเทศนักศึกษาใหม่: ก้าวแรกสู่รั้วมหาวิทยาลัยยุคดิจิทัล", "2566", "4/7/2566", 1, null, "ผ่าน"));
        // thonburi-study
        initial.add(createAct(studentId, "thonburi-study", "ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา", "มหาวิทยาลัย", "แหล่งเรียนรู้กรุงธนบุรีศึกษา", "2569", "15/7/2569", 1, null, "ผ่าน"));
        // digital-new
        initial.add(createAct(studentId, "digital-new", "ทักษะดิจิทัลสำหรับนักศึกษาใหม่", "ทักษะดิจิทัล", "พัฒนาทักษะดิจิทัลและการทดสอบดิจิทัลสำหรับนักศึกษาใหม่", "2566", "22/7/2566", 1, null, "ผ่าน"));
        // fac-elective
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "ถวายเทียนพรรษา สืบสานวัฒนธรรมไทย ประจำปี 2566", "2566", "7/7/2566", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "แฟชั่นโชว์เพื่อผลสัมฤทธิ์ทางการเรียน", "2566", "21/11/2566", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "ละครนอก ขุนช้างขุนแผน [งานวันพิราลัย]", "2566", "17/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "การประกวดแฟชั่นโชว์ [งานวันพิราลัย]", "2566", "18/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "เปิดบ้านวิทยาการ [วันคล้ายวันพิราลัย]", "2566", "18/1/2567", 1, null, "ผ่าน"));
        initial.add(createAct(studentId, "fac-elective", "กิจกรรมเลือก (คณะ)", "คณะ", "เภสัชกรรมไทย หมอยาไทย สาธิตการทำสมุนไพร [วันคล้ายวันพิราลัย]", "2566", "19/1/2567", 1, null, "ผ่าน"));

        activityRepository.saveAll(initial);
        syncGraduationProgress(studentId);
    }

    private StudentActivity createAct(String studentId, String catId, String name, String group,
                                      String title, String year, String date, int count, Integer hours, String status) {
        StudentActivity a = new StudentActivity();
        a.setStudentId(studentId);
        a.setActivityCategoryId(catId);
        a.setCategoryName(name);
        a.setCategoryGroup(group);
        a.setTitle(title);
        a.setAcademicYear(year);
        a.setActivityDate(date);
        a.setCount(count);
        a.setHours(hours);
        a.setStatus(status);
        a.setCreatedAt(LocalDateTime.now());
        return a;
    }
}
