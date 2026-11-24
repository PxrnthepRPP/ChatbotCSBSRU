package com.bsru.studentportal.service;

import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.CourseGrade;
import com.bsru.studentportal.model.CourseGradeSchedule;
import com.bsru.studentportal.model.GraduationAudit;
import com.bsru.studentportal.model.InstructorGrade;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.repository.CourseGradeRepository;
import com.bsru.studentportal.repository.CourseGradeScheduleRepository;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.InstructorGradeRepository;
import com.bsru.studentportal.repository.SectionEnrollmentRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Computes a student's graduation audit from the stored sheet (curriculum + courses taken).
 * Single source of truth for the "ตรวจสอบจบ" page and the chatbot.
 *
 * Node rules (field "rule"):
 *  - default: credits add up; PASS when earned >= minCr (minCr defaults to the sum of the children's)
 *  - ONE_PER_GROUP: pick one course in each of "groupsRequired" different groups (GE 1.2)
 *  - CHOOSE_ONE: the best child counts, e.g. internship plan OR co-op plan (2.3)
 *  - REQUIREMENT: non-credit requirement, PASS when every course has "passed": true (skills tests)
 * A "unit" is a category that is checked on its own (a node whose children are course groups);
 * the summary counts units, credits and lists what is still missing.
 */
@Service
public class GraduationAuditService {

    private static final String PASS = "PASS";
    private static final String FAIL = "FAIL";

    private static final Map<String, Double> GRADE_POINTS = Map.of(
            "A", 4.0, "B+", 3.5, "B", 3.0, "C+", 2.5, "C", 2.0, "D+", 1.5, "D", 1.0, "F", 0.0);

    private final GraduationAuditRepository repository;
    private final StudentRepository studentRepository;
    private final ObjectMapper objectMapper;
    private final CourseGradeRepository courseGradeRepository;
    private final SectionEnrollmentRepository enrollmentRepository;
    private final InstructorGradeRepository instructorGradeRepository;
    private final CourseGradeScheduleRepository gradeScheduleRepository;

    public GraduationAuditService(GraduationAuditRepository repository,
                                  StudentRepository studentRepository,
                                  ObjectMapper objectMapper) {
        this(repository, studentRepository, objectMapper, null, null, null, null);
    }

    @Autowired
    public GraduationAuditService(GraduationAuditRepository repository,
                                  StudentRepository studentRepository,
                                  ObjectMapper objectMapper,
                                  @Autowired(required = false) CourseGradeRepository courseGradeRepository,
                                  @Autowired(required = false) SectionEnrollmentRepository enrollmentRepository,
                                  @Autowired(required = false) InstructorGradeRepository instructorGradeRepository,
                                  @Autowired(required = false) CourseGradeScheduleRepository gradeScheduleRepository) {
        this.repository = repository;
        this.studentRepository = studentRepository;
        this.objectMapper = objectMapper;
        this.courseGradeRepository = courseGradeRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.instructorGradeRepository = instructorGradeRepository;
        this.gradeScheduleRepository = gradeScheduleRepository;
    }

    private String cleanCurriculumTemplate;
    private String somchaiTemplate;

    public synchronized String getCleanCurriculumTemplate() {
        if (cleanCurriculumTemplate != null) return cleanCurriculumTemplate;
        try {
            ClassPathResource res = new ClassPathResource("graduation/curriculum-template.json");
            if (res.exists()) {
                try (InputStream in = res.getInputStream()) {
                    cleanCurriculumTemplate = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    return cleanCurriculumTemplate;
                }
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    public synchronized String getSomchaiCurriculum() {
        if (somchaiTemplate != null) return somchaiTemplate;
        try {
            ClassPathResource res = new ClassPathResource("graduation/6621207042.json");
            if (!res.exists()) {
                res = new ClassPathResource("graduation/6621207042.json.bak");
            }
            if (res.exists()) {
                try (InputStream in = res.getInputStream()) {
                    somchaiTemplate = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    return somchaiTemplate;
                }
            }
        } catch (IOException ignored) {}
        return null;
    }

    public boolean isSomchai(String studentId) {
        if (studentId == null) return false;
        if ("6421100042".equals(studentId) || "6621207042".equals(studentId)) {
            return true;
        }
        if (studentRepository != null) {
            return studentRepository.findById(studentId)
                    .map(s -> s.getNameTh() != null && s.getNameTh().contains("สมชาย"))
                    .orElse(false);
        }
        return false;
    }

    /** One category checked on its own, for the chatbot and the summary */
    public record Unit(String section, String title, String status, Integer minCr, int passCr, String note) {}

    public record AuditResult(JsonNode audit, List<Unit> units) {}

    @Transactional(readOnly = true)
    public Optional<AuditResult> auditOf(String studentId) {
        if (isSomchai(studentId)) {
            Optional<GraduationAudit> stored = repository.findById(studentId);
            if (stored.isPresent()) {
                return Optional.of(compute(stored.get().getData()));
            }
            String somchaiData = getSomchaiCurriculum();
            if (somchaiData != null) {
                return Optional.of(compute(somchaiData));
            }
        }

        // For other students / real students: dynamic linking from real courses + curriculum template
        String baseJson = repository.findById(studentId).map(GraduationAudit::getData).orElse(null);
        if (baseJson == null) {
            baseJson = getCleanCurriculumTemplate();
        }
        if (baseJson != null) {
            return Optional.of(buildDynamicAudit(studentId, baseJson));
        }
        return Optional.empty();
    }

    /** The stored sheet as uploaded (no computed fields), e.g. to download as a template */
    @Transactional(readOnly = true)
    public Optional<String> rawOf(String studentId) {
        if (isSomchai(studentId)) {
            Optional<String> stored = repository.findById(studentId).map(GraduationAudit::getData);
            if (stored.isPresent()) return stored;
            return Optional.ofNullable(getSomchaiCurriculum());
        }
        String template = getCleanCurriculumTemplate();
        return Optional.ofNullable(template);
    }

    /**
     * Saves an uploaded sheet after checking it can be evaluated. Computed fields (status, passCr,
     * gpa, summary...) are removed first, so only raw curriculum and course data is stored.
     */
    @Transactional
    public AuditResult save(String studentId, String json) {
        JsonNode root;
        try {
            root = objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง: " + e.getOriginalMessage());
        }
        if (root == null || !root.path("sections").isArray() || root.path("sections").isEmpty()) {
            throw new IllegalArgumentException("ไม่พบ \"sections\" (โครงหมวดวิชา) ในไฟล์");
        }
        stripComputed(root);
        String clean = root.toString();
        AuditResult result;
        try {
            result = compute(clean);
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("ประมวลผลใบตรวจสอบจบไม่ได้: " + e.getMessage());
        }
        repository.save(new GraduationAudit(studentId, clean));
        syncProfileGpa(studentId, result);
        return result;
    }

    /**
     * The audit covers every course the student took, so its GPA is the cumulative GPA: copy it to
     * students.gpa so the profile, admin, advisor pages and chatbot all show the same number.
     */
    @Transactional
    public void syncAllProfileGpas() {
        repository.findAll().forEach(a -> syncProfileGpa(a.getStudentId(), compute(a.getData())));
    }

    private void syncProfileGpa(String studentId, AuditResult result) {
        int graded = result.audit().path("summary").path("gradedCredits").asInt(0);
        double gpa = graded > 0 ? result.audit().path("summary").path("currentGpa").asDouble() : 0.0;
        studentRepository.findById(studentId).ifPresent(s -> {
            if (s.getGpa() == null || Math.abs(s.getGpa() - gpa) > 0.001) {
                s.setGpa(gpa);
                studentRepository.save(s);
            }
        });
    }

    private static void stripComputed(JsonNode node) {
        if (node instanceof ObjectNode obj) {
            obj.remove(List.of("summary", "status", "passCr", "gpa", "groupsPassed", "violation"));
            obj.fields().forEachRemaining(e -> stripComputed(e.getValue()));
        } else if (node instanceof ArrayNode arr) {
            arr.forEach(GraduationAuditService::stripComputed);
        }
    }

    public static class StudentCourseRecord {
        String code;
        String name;
        int credits = 3;
        String latestGrade;
        Double latestGradePoint;
        Map<String, String> termEntries = new LinkedHashMap<>();

        public void addAttempt(int academicYear, int term, String grade, Double point, int termIndex) {
            int year2 = academicYear >= 2500 ? academicYear - 2500 : academicYear;
            String termVal = (grade != null && !grade.isBlank())
                    ? (grade.trim() + " " + term + "/" + year2)
                    : ("-- " + term + "/" + year2);
            termEntries.put(String.valueOf(termIndex), termVal);

            if (grade != null && !grade.isBlank()) {
                boolean isPass = !"F".equalsIgnoreCase(grade.trim());
                if (latestGrade == null || "F".equalsIgnoreCase(latestGrade) || isPass) {
                    latestGrade = grade.trim();
                    latestGradePoint = point;
                }
            }
        }
    }

    public AuditResult buildDynamicAudit(String studentId, String baseJson) {
        ObjectNode root;
        try {
            root = (ObjectNode) objectMapper.readTree(baseJson);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Graduation audit JSON is invalid", e);
        }

        // Section 3: Ensure courses array is clean
        ObjectNode sec3 = findSection(root, "sec-3");
        ArrayNode sec3Courses = null;
        if (sec3 != null) {
            ArrayNode groups = sec3.withArray("groups");
            ObjectNode g0 = groups.isEmpty() ? groups.addObject() : (ObjectNode) groups.get(0);
            if (!g0.has("code")) g0.put("code", "3.");
            if (!g0.has("title")) g0.put("title", "หมวดวิชาเลือกเสรี");
            if (!g0.has("minCr")) g0.put("minCr", 6);
            sec3Courses = g0.putArray("courses");
        }

        // Collect all course nodes from Sections 1, 2, and 4
        Map<String, ObjectNode> criteriaCourses = new LinkedHashMap<>();
        for (JsonNode sec : root.withArray("sections")) {
            String secId = sec.path("id").asText();
            if ("sec-3".equalsIgnoreCase(secId)) continue;
            collectCriteriaCourses(sec, criteriaCourses);
        }

        // Gather real student courses
        Map<String, StudentCourseRecord> studentCourses = getStudentCourses(studentId);

        // Overlay student courses into criteria (Sections 1, 2, 4) or Free Electives (Section 3)
        for (StudentCourseRecord scr : studentCourses.values()) {
            String codeKey = scr.code.trim().toUpperCase();
            if (criteriaCourses.containsKey(codeKey)) {
                ObjectNode cNode = criteriaCourses.get(codeKey);
                applyCourseRecord(cNode, scr);
            } else if (sec3Courses != null) {
                ObjectNode cNode = sec3Courses.addObject();
                cNode.put("code", scr.code);
                cNode.put("name", scr.name != null && !scr.name.isBlank() ? scr.name : scr.code);
                cNode.put("credits", scr.credits + "(3-0-6)");
                applyCourseRecord(cNode, scr);
            }
        }

        return compute(root.toString());
    }

    private void collectCriteriaCourses(JsonNode node, Map<String, ObjectNode> map) {
        if (node == null) return;
        if (node.has("courses") && node.get("courses").isArray()) {
            for (JsonNode c : node.get("courses")) {
                if (c instanceof ObjectNode obj && obj.hasNonNull("code")) {
                    map.put(obj.get("code").asText().trim().toUpperCase(), obj);
                }
            }
        }
        if (node.has("groups") && node.get("groups").isArray()) {
            for (JsonNode g : node.get("groups")) {
                collectCriteriaCourses(g, map);
            }
        }
        if (node.has("subsections") && node.get("subsections").isArray()) {
            for (JsonNode s : node.get("subsections")) {
                collectCriteriaCourses(s, map);
            }
        }
    }

    private ObjectNode findSection(ObjectNode root, String secId) {
        if (!root.has("sections")) return null;
        for (JsonNode sec : root.get("sections")) {
            if (secId.equalsIgnoreCase(sec.path("id").asText()) && sec instanceof ObjectNode obj) {
                return obj;
            }
        }
        return null;
    }

    private void applyCourseRecord(ObjectNode cNode, StudentCourseRecord scr) {
        int credits = scr.credits > 0 ? scr.credits : 3;
        if (scr.latestGrade != null) {
            if ("F".equalsIgnoreCase(scr.latestGrade)) {
                cNode.put("ca", 0);
                cNode.put("attempted", credits);
                cNode.put("pt", 0.0);
                cNode.put("avg", "0.00");
                cNode.put("max", "0.00");
                if (cNode.has("passed")) cNode.put("passed", false);
            } else {
                cNode.put("ca", credits);
                cNode.put("attempted", credits);
                double pt = scr.latestGradePoint != null ? scr.latestGradePoint * credits : 0.0;
                cNode.put("pt", pt);
                String gpaStr = scr.latestGradePoint != null
                        ? String.format(Locale.ROOT, "%.2f", scr.latestGradePoint)
                        : "0.00";
                cNode.put("avg", gpaStr);
                cNode.put("max", gpaStr);
                if (cNode.has("passed")) cNode.put("passed", true);
            }
        } else {
            cNode.putNull("ca");
            cNode.putNull("pt");
            cNode.putNull("avg");
            cNode.putNull("max");
            if (cNode.has("passed")) cNode.put("passed", false);
        }

        ObjectNode termsNode = cNode.has("terms") && cNode.get("terms").isObject()
                ? (ObjectNode) cNode.get("terms")
                : cNode.putObject("terms");
        for (Map.Entry<String, String> entry : scr.termEntries.entrySet()) {
            termsNode.put(entry.getKey(), entry.getValue());
        }
    }

    private int calculateTermIndex(String studentId, int academicYear, int term) {
        int admissionBatch = 66;
        if (studentId != null && studentId.length() >= 2) {
            try {
                admissionBatch = Integer.parseInt(studentId.substring(0, 2));
            } catch (NumberFormatException ignored) {}
        }
        int year2 = academicYear >= 2500 ? academicYear - 2500 : academicYear;
        if (year2 <= 0) return 1;
        int index = (year2 - admissionBatch) * 2 + (term > 0 ? term : 1);
        if (index < 1) return 1;
        return index;
    }

    private Map<String, StudentCourseRecord> getStudentCourses(String studentId) {
        Map<String, StudentCourseRecord> map = new LinkedHashMap<>();

        // 1. Graded courses from courseGradeRepository
        if (courseGradeRepository != null && studentId != null) {
            List<CourseGrade> grades = courseGradeRepository
                    .findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(studentId);
            List<CourseGrade> chronological = new ArrayList<>(grades);
            chronological.sort(Comparator.comparing(CourseGrade::getAcademicYear, Comparator.nullsFirst(Comparator.naturalOrder()))
                    .thenComparing(CourseGrade::getTerm, Comparator.nullsFirst(Comparator.naturalOrder())));
            for (CourseGrade g : chronological) {
                if (g.getCourseCode() == null) continue;
                String codeKey = g.getCourseCode().trim().toUpperCase();
                StudentCourseRecord scr = map.computeIfAbsent(codeKey, k -> {
                    StudentCourseRecord r = new StudentCourseRecord();
                    r.code = g.getCourseCode().trim();
                    r.name = g.getCourseName();
                    r.credits = g.getCredits() != null ? g.getCredits() : 3;
                    return r;
                });
                if (g.getCourseName() != null && !g.getCourseName().isBlank()) scr.name = g.getCourseName();
                if (g.getCredits() != null && g.getCredits() > 0) scr.credits = g.getCredits();
                int termIdx = calculateTermIndex(studentId, g.getAcademicYear() != null ? g.getAcademicYear() : 0,
                        g.getTerm() != null ? g.getTerm() : 1);
                scr.addAttempt(g.getAcademicYear() != null ? g.getAcademicYear() : 0,
                        g.getTerm() != null ? g.getTerm() : 1, g.getGrade(), g.getGradePoint(), termIdx);
            }
        }

        // 2. Released grades from instructorGradeRepository
        if (instructorGradeRepository != null && gradeScheduleRepository != null && enrollmentRepository != null && studentId != null) {
            LocalDateTime now = LocalDateTime.now();
            List<InstructorGrade> instructorGrades = instructorGradeRepository.findByStudentStudentId(studentId);
            for (InstructorGrade ig : instructorGrades) {
                ClassSection sec = ig.getSection();
                if (sec == null || sec.getCourseCode() == null) continue;
                boolean released = gradeScheduleRepository
                        .findByAcademicYearAndTermAndCourseCodeIgnoreCase(sec.getAcademicYear(), sec.getTerm(), sec.getCourseCode())
                        .map(CourseGradeSchedule::getReleaseAt)
                        .filter(at -> !at.isAfter(now))
                        .isPresent();
                boolean enrolled = enrollmentRepository.findByStudentStudentIdAndSectionId(studentId, sec.getId())
                        .filter(e -> e.getStatus() == EnrollmentStatus.CONFIRMED).isPresent();
                if (released && enrolled) {
                    String codeKey = sec.getCourseCode().trim().toUpperCase();
                    StudentCourseRecord scr = map.computeIfAbsent(codeKey, k -> {
                        StudentCourseRecord r = new StudentCourseRecord();
                        r.code = sec.getCourseCode().trim();
                        r.name = sec.getCourseName();
                        r.credits = sec.getCredits() != null ? sec.getCredits() : 3;
                        return r;
                    });
                    if (sec.getCourseName() != null && !sec.getCourseName().isBlank()) scr.name = sec.getCourseName();
                    if (sec.getCredits() != null && sec.getCredits() > 0) scr.credits = sec.getCredits();
                    int termIdx = calculateTermIndex(studentId, sec.getAcademicYear() != null ? sec.getAcademicYear() : 0,
                            sec.getTerm() != null ? sec.getTerm() : 1);
                    scr.addAttempt(sec.getAcademicYear() != null ? sec.getAcademicYear() : 0,
                            sec.getTerm() != null ? sec.getTerm() : 1, ig.getGrade(), GRADE_POINTS.get(ig.getGrade()), termIdx);
                }
            }
        }

        // 3. Timetable enrollments from enrollmentRepository (in progress / pending)
        if (enrollmentRepository != null && studentId != null) {
            List<SectionEnrollment> enrollments = enrollmentRepository.findByStudentStudentId(studentId);
            for (SectionEnrollment se : enrollments) {
                if (se.getStatus() != EnrollmentStatus.CONFIRMED || se.getSection() == null) continue;
                ClassSection sec = se.getSection();
                if (sec.getCourseCode() == null) continue;
                String codeKey = sec.getCourseCode().trim().toUpperCase();
                StudentCourseRecord scr = map.computeIfAbsent(codeKey, k -> {
                    StudentCourseRecord r = new StudentCourseRecord();
                    r.code = sec.getCourseCode().trim();
                    r.name = sec.getCourseName();
                    r.credits = sec.getCredits() != null ? sec.getCredits() : 3;
                    return r;
                });
                if (sec.getCourseName() != null && !sec.getCourseName().isBlank()) scr.name = sec.getCourseName();
                if (sec.getCredits() != null && sec.getCredits() > 0) scr.credits = sec.getCredits();
                int termIdx = calculateTermIndex(studentId, sec.getAcademicYear() != null ? sec.getAcademicYear() : 0,
                        sec.getTerm() != null ? sec.getTerm() : 1);
                if (!scr.termEntries.containsKey(String.valueOf(termIdx))) {
                    scr.addAttempt(sec.getAcademicYear() != null ? sec.getAcademicYear() : 0,
                            sec.getTerm() != null ? sec.getTerm() : 1, null, null, termIdx);
                }
            }
        }

        return map;
    }

    AuditResult compute(String json) {
        ObjectNode root;
        try {
            root = (ObjectNode) objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("graduation audit JSON is invalid", e);
        }
        List<Unit> units = new ArrayList<>();
        List<String> pending = new ArrayList<>();
        for (JsonNode section : root.withArray("sections")) {
            evaluate((ObjectNode) section, section.path("title").asText(), units, pending);
        }

        Totals all = totalsOf(root.withArray("sections"));
        double minGpa = root.path("minGpa").asDouble(2.0);
        int required = units.stream().mapToInt(u -> u.minCr() == null ? 0 : u.minCr()).sum();
        int earned = units.stream().mapToInt(u -> u.minCr() == null ? 0 : Math.min(u.passCr(), u.minCr())).sum();
        long passed = units.stream().filter(u -> PASS.equals(u.status())).count();
        boolean gpaOk = all.gpa() >= minGpa;
        boolean graduated = passed == units.size() && gpaOk;

        List<String> missing = new ArrayList<>();
        for (Unit u : units) {
            if (PASS.equals(u.status())) continue;
            missing.add(u.title() + " — " + u.note());
        }
        if (!gpaOk) missing.add(String.format(Locale.ROOT, "GPA %.2f ต่ำกว่าเกณฑ์ %.2f", all.gpa(), minGpa));
        missing.addAll(pending);

        ObjectNode summary = root.putObject("summary");
        summary.put("totalRequiredCredits", required);
        summary.put("totalEarnedCredits", earned);
        summary.put("gradedCredits", all.gpaCredits());
        summary.put("currentGpa", round2(all.gpa()));
        summary.put("minGpa", minGpa);
        summary.put("status", graduated ? "ผ่านเงื่อนไข" : "ยังไม่ผ่านเงื่อนไข");
        summary.put("passedCategories", passed);
        summary.put("totalCategories", units.size());
        ArrayNode list = summary.putArray("pendingRequirements");
        missing.forEach(list::add);
        return new AuditResult(root, units);
    }

    /** Fills status / passCr / minCr / gpa on the node and its children; returns nothing, mutates in place */
    private void evaluate(ObjectNode node, String sectionTitle, List<Unit> units, List<String> pending) {
        ArrayNode groups = node.has("groups") ? (ArrayNode) node.get("groups") : null;
        ArrayNode subsections = node.has("subsections") ? (ArrayNode) node.get("subsections") : null;
        String rule = node.path("rule").asText("");

        if (node.has("courses")) {
            evaluateGroup(node, pending);
            return;
        }
        if (groups != null) {
            for (JsonNode g : groups) evaluateGroup((ObjectNode) g, pending);
            switch (rule) {
                case "ONE_PER_GROUP" -> evaluateOnePerGroup(node, groups);
                case "CHOOSE_ONE" -> evaluateChooseOne(node, groups);
                default -> evaluateSum(node, groups);
            }
            node.put("gpa", formatGpa(totalsOf(groups)));
            units.add(new Unit(sectionTitle, node.path("title").asText(), node.path("status").asText(null),
                    node.hasNonNull("minCr") ? node.get("minCr").asInt() : null,
                    node.path("passCr").asInt(0), noteOf(node)));
            return;
        }
        if (subsections != null) {
            for (JsonNode s : subsections) evaluate((ObjectNode) s, sectionTitle, units, pending);
            evaluateSum(node, subsections);
            node.put("gpa", formatGpa(totalsOf(subsections)));
        }
    }

    /** A course group: credits and grade points of passed courses; status only when it has its own rule */
    private void evaluateGroup(ObjectNode group, List<String> pending) {
        ArrayNode courses = group.withArray("courses");
        Totals t = totalsOfCourses(courses);
        group.put("passCr", t.credits());
        group.put("gpa", formatGpa(t));
        for (JsonNode c : courses) {
            JsonNode terms = c.path("terms");
            terms.fields().forEachRemaining(e -> {
                if (e.getValue().asText().startsWith("--")) {
                    pending.add("รอผลรายวิชา " + c.path("code").asText() + " " + c.path("name").asText()
                            + " (" + e.getValue().asText().replace("--", "").trim() + ")");
                }
            });
        }
        if ("REQUIREMENT".equals(group.path("rule").asText())) {
            boolean all = courses.size() > 0;
            for (JsonNode c : courses) all &= c.path("passed").asBoolean(false);
            group.put("status", all ? PASS : FAIL);
            group.putNull("passCr");
        } else if (group.hasNonNull("minCr")) {
            group.put("status", t.credits() >= group.get("minCr").asInt() ? PASS : FAIL);
        } else {
            group.putNull("status");
        }
    }

    private void evaluateSum(ObjectNode node, ArrayNode children) {
        int earned = 0;
        Integer childMin = null;
        boolean anyFail = false;
        boolean allPass = children.size() > 0;
        for (JsonNode c : children) {
            earned += c.path("passCr").asInt(0);
            if (c.hasNonNull("minCr")) childMin = (childMin == null ? 0 : childMin) + c.get("minCr").asInt();
            anyFail |= FAIL.equals(c.path("status").asText());
            allPass &= PASS.equals(c.path("status").asText());
        }
        if (!node.hasNonNull("minCr") && childMin != null) node.put("minCr", childMin);
        node.put("passCr", earned);
        if (anyFail) node.put("status", FAIL);
        else if (node.hasNonNull("minCr")) node.put("status", earned >= node.get("minCr").asInt() ? PASS : FAIL);
        else node.put("status", allPass ? PASS : FAIL);
    }

    private void evaluateOnePerGroup(ObjectNode node, ArrayNode groups) {
        int needed = node.path("groupsRequired").asInt(3);
        int distinct = 0;
        int earned = 0;
        List<String> violations = new ArrayList<>();
        for (JsonNode g : groups) {
            List<JsonNode> passed = new ArrayList<>();
            for (JsonNode c : g.withArray("courses")) if (c.path("ca").asInt(0) > 0) passed.add(c);
            ObjectNode group = (ObjectNode) g;
            if (passed.isEmpty()) {
                group.putNull("status");
                group.putNull("passCr");
                continue;
            }
            if (passed.size() > 1) violations.add(g.path("code").asText() + " เรียนเกินกลุ่มละ 1 วิชา");
            group.put("status", PASS);
            group.put("passCr", passed.get(0).path("ca").asInt());
            if (distinct < needed) earned += passed.get(0).path("ca").asInt();
            distinct++;
        }
        node.put("passCr", earned);
        node.put("groupsPassed", distinct);
        boolean ok = distinct >= needed && violations.isEmpty() && (!node.hasNonNull("minCr") || earned >= node.get("minCr").asInt());
        node.put("status", ok ? PASS : FAIL);
        if (!violations.isEmpty()) node.put("violation", String.join(", ", violations));
    }

    private void evaluateChooseOne(ObjectNode node, ArrayNode plans) {
        int best = 0;
        for (JsonNode p : plans) {
            best = Math.max(best, p.path("passCr").asInt(0));
            ((ObjectNode) p).putNull("status");
        }
        node.put("passCr", best);
        node.put("status", node.hasNonNull("minCr") && best >= node.get("minCr").asInt() ? PASS : FAIL);
    }

    private static String noteOf(JsonNode node) {
        if ("REQUIREMENT".equals(node.path("groups").path(0).path("rule").asText())) {
            List<String> notPassed = new ArrayList<>();
            for (JsonNode c : node.path("groups").path(0).path("courses")) {
                if (!c.path("passed").asBoolean(false)) notPassed.add(c.path("code").asText() + " " + c.path("name").asText());
            }
            return notPassed.isEmpty() ? "ผ่านครบ" : "ยังไม่ผ่าน: " + String.join(", ", notPassed);
        }
        int earned = node.path("passCr").asInt(0);
        Integer min = node.hasNonNull("minCr") ? node.get("minCr").asInt() : null;
        String text = min == null ? "ได้ " + earned + " หน่วยกิต"
                : "ได้ " + earned + "/" + min + " หน่วยกิต" + (earned < min ? " (ขาดอีก " + (min - earned) + ")" : "");
        if (node.has("groupsPassed")) {
            text += " จาก " + node.get("groupsPassed").asInt() + "/" + node.path("groupsRequired").asInt(3) + " กลุ่ม";
        }
        if (node.has("violation")) text += " — " + node.get("violation").asText();
        return text;
    }

    /**
     * credits = credits earned (passed courses); gpaCredits also counts failed attempts
     * (a course with "attempted": n and "ca": 0, e.g. grade F), which lower the GPA but earn nothing.
     */
    private record Totals(int credits, int gpaCredits, double points) {
        double gpa() {
            return gpaCredits == 0 ? 0 : points / gpaCredits;
        }
    }

    private static Totals totalsOf(JsonNode nodes) {
        int credits = 0;
        int gpaCredits = 0;
        double points = 0;
        for (JsonNode n : nodes) {
            Totals t = n.has("courses") ? totalsOfCourses(n.get("courses"))
                    : totalsOf(n.has("groups") ? n.get("groups") : n.path("subsections"));
            credits += t.credits();
            gpaCredits += t.gpaCredits();
            points += t.points();
        }
        return new Totals(credits, gpaCredits, points);
    }

    private static Totals totalsOfCourses(JsonNode courses) {
        int credits = 0;
        int gpaCredits = 0;
        double points = 0;
        for (JsonNode c : courses) {
            int ca = c.path("ca").asInt(0);
            int attempted = ca > 0 ? ca : c.path("attempted").asInt(0);
            if (attempted <= 0) continue;
            credits += ca;
            gpaCredits += attempted;
            points += c.path("pt").asDouble(0);
        }
        return new Totals(credits, gpaCredits, points);
    }

    private static String formatGpa(Totals t) {
        return String.format(Locale.ROOT, "%.2f", t.gpa());
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
