package com.bsru.studentportal.service;

import com.bsru.studentportal.model.GraduationAudit;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
@RequiredArgsConstructor
public class GraduationAuditService {

    private static final String PASS = "PASS";
    private static final String FAIL = "FAIL";

    private final GraduationAuditRepository repository;
    private final StudentRepository studentRepository;
    private final ObjectMapper objectMapper;

    /** One category checked on its own, for the chatbot and the summary */
    public record Unit(String section, String title, String status, Integer minCr, int passCr, String note) {}

    public record AuditResult(JsonNode audit, List<Unit> units) {}

    @Transactional(readOnly = true)
    public Optional<AuditResult> auditOf(String studentId) {
        return repository.findById(studentId).map(stored -> compute(stored.getData()));
    }

    /** The stored sheet as uploaded (no computed fields), e.g. to download as a template */
    @Transactional(readOnly = true)
    public Optional<String> rawOf(String studentId) {
        return repository.findById(studentId).map(GraduationAudit::getData);
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
        double gpa = result.audit().path("summary").path("currentGpa").asDouble();
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
