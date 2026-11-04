package com.bsru.studentportal.service;

import com.bsru.studentportal.model.FaqEntry;
import com.bsru.studentportal.repository.FaqEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Frequently asked questions: admin CRUD, CSV import/export and matching a chat message.
 * Thai has no spaces between words, so matching compares character pairs (bigrams) of the
 * normalised texts rather than words.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FaqService {

    /** At or above this a FAQ with exactAnswer=true is sent word for word */
    public static final double EXACT_THRESHOLD = 0.80;
    /** At or above this a FAQ is given to the AI as reference material */
    public static final double REFERENCE_THRESHOLD = 0.45;

    private static final int MAX_QUESTION = 1000;
    private static final int MAX_ANSWER = 8000;
    private static final Pattern NOT_LETTER = Pattern.compile("[^\\p{L}\\p{N}]+");
    /** Polite words that do not change the meaning of a question */
    private static final List<String> FILLERS = List.of(
            "ครับ", "คับ", "ค่ะ", "คะ", "จ้า", "จ้ะ", "นะ", "หน่อย", "ด้วย", "ไหม", "มั้ย", "บ้าง",
            "อยากทราบว่า", "อยากทราบ", "อยากรู้ว่า", "อยากรู้", "ขอถามว่า", "ขอถาม", "สอบถาม", "รบกวน");

    private final FaqEntryRepository repository;

    public record Match(FaqEntry entry, double score) {
        public boolean answersExactly() {
            return entry.isExactAnswer() && score >= EXACT_THRESHOLD;
        }
    }

    /** The admin's view of a FAQ, sorted by category */
    @Transactional(readOnly = true)
    public List<FaqEntry> list() {
        return repository.findAllByOrderByCategoryAscIdAsc();
    }

    @Transactional
    public FaqEntry create(FaqEntry input) {
        FaqEntry e = new FaqEntry();
        apply(e, input);
        return repository.save(e);
    }

    @Transactional
    public FaqEntry update(Long id, FaqEntry input) {
        FaqEntry e = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบคำถามที่พบบ่อยรายการนี้"));
        apply(e, input);
        return repository.save(e);
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบคำถามที่พบบ่อยรายการนี้");
        }
        repository.deleteById(id);
    }

    private static void apply(FaqEntry target, FaqEntry input) {
        String question = trim(input.getQuestion());
        String answer = trim(input.getAnswer());
        if (question.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณากรอกคำถาม");
        if (answer.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณากรอกคำตอบ");
        if (question.length() > MAX_QUESTION) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "คำถามยาวเกิน " + MAX_QUESTION + " ตัวอักษร");
        if (answer.length() > MAX_ANSWER) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "คำตอบยาวเกิน " + MAX_ANSWER + " ตัวอักษร");
        String category = trim(input.getCategory());
        target.setCategory(category.isEmpty() ? "ทั่วไป" : (category.length() > 100 ? category.substring(0, 100) : category));
        target.setQuestion(question);
        target.setAlternatives(String.join("\n", splitAlternatives(input.getAlternatives())));
        target.setAnswer(answer);
        target.setExactAnswer(input.isExactAnswer());
        target.setActive(input.isActive());
    }

    // ------------------------------------------------------------------ matching

    /** Best active FAQ for a chat message, if it is at least close enough to use as reference */
    @Transactional(readOnly = true)
    public Optional<Match> bestMatch(String message) {
        return matches(message, 1).stream().findFirst();
    }

    /** Up to {@code limit} active FAQs close enough to the message, best first */
    @Transactional(readOnly = true)
    public List<Match> matches(String message, int limit) {
        String text = normalize(message);
        if (text.length() < 2) return List.of();
        List<Match> found = new ArrayList<>();
        for (FaqEntry e : repository.findByActiveTrue()) {
            double best = 0;
            List<String> phrasings = new ArrayList<>(splitAlternatives(e.getAlternatives()));
            phrasings.add(0, e.getQuestion());
            for (String p : phrasings) best = Math.max(best, similarity(text, normalize(p)));
            if (best >= REFERENCE_THRESHOLD) found.add(new Match(e, best));
        }
        found.sort(Comparator.comparingDouble(Match::score).reversed());
        return found.size() > limit ? found.subList(0, limit) : found;
    }

    /** Counts that a FAQ answered or helped answer a question */
    @Transactional
    public void recordHit(Long faqId) {
        if (faqId == null) return;
        repository.findById(faqId).ifPresent(e -> {
            e.setHitCount(e.getHitCount() + 1);
            e.setLastHitAt(LocalDateTime.now());
            repository.save(e);
        });
    }

    /** Text for the AI prompt: the FAQs closest to the message */
    public String promptContext(List<Match> matches) {
        if (matches.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("\n[คำถามที่พบบ่อยที่ผู้ดูแลระบบกำหนดไว้ (ใช้เป็นข้อมูลอ้างอิงหลักถ้าตรงกับคำถาม)]:\n");
        for (Match m : matches) {
            sb.append("- ถาม: ").append(m.entry().getQuestion()).append("\n  ตอบ: ").append(m.entry().getAnswer()).append('\n');
        }
        return sb.toString();
    }

    /** Lower case, no spaces or punctuation, no polite filler words */
    static String normalize(String s) {
        if (s == null) return "";
        String t = s.toLowerCase(Locale.ROOT);
        for (String f : FILLERS) t = t.replace(f, " ");
        return NOT_LETTER.matcher(t).replaceAll("");
    }

    /** Dice coefficient over character pairs; a FAQ question found whole inside the message counts as a close match */
    static double similarity(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        if (a.equals(b)) return 1;
        String shorter = a.length() <= b.length() ? a : b;
        String longer = shorter == a ? b : a;
        double contained = (shorter.length() >= 6 && longer.contains(shorter))
                ? 0.80 + 0.20 * shorter.length() / longer.length() : 0;
        Set<String> x = bigrams(a);
        Set<String> y = bigrams(b);
        if (x.isEmpty() || y.isEmpty()) return contained;
        Set<String> common = new HashSet<>(x);
        common.retainAll(y);
        double dice = 2.0 * common.size() / (x.size() + y.size());
        return Math.max(dice, contained);
    }

    private static Set<String> bigrams(String s) {
        Set<String> out = new HashSet<>();
        for (int i = 0; i + 1 < s.length(); i++) out.add(s.substring(i, i + 2));
        return out;
    }

    private static List<String> splitAlternatives(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("\\r?\\n|\\|"))
                .map(String::trim).filter(x -> !x.isEmpty()).distinct().toList();
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    // ------------------------------------------------------------------ CSV

    private static final String[] CSV_HEADER = {"id", "หมวด", "คำถาม", "คำถามแบบอื่น (คั่นด้วย |)", "คำตอบ", "ตอบตามนี้เป๊ะ (ใช่/ไม่)", "เปิดใช้ (ใช่/ไม่)"};

    /** Every FAQ as CSV (UTF-8 with BOM so Excel shows Thai correctly) */
    @Transactional(readOnly = true)
    public String exportCsv() {
        StringBuilder sb = new StringBuilder("﻿");
        sb.append(String.join(",", Arrays.stream(CSV_HEADER).map(FaqService::csvCell).toList())).append("\r\n");
        for (FaqEntry e : list()) {
            sb.append(String.join(",", List.of(
                    String.valueOf(e.getId()), csvCell(e.getCategory()), csvCell(e.getQuestion()),
                    csvCell(String.join(" | ", splitAlternatives(e.getAlternatives()))), csvCell(e.getAnswer()),
                    e.isExactAnswer() ? "ใช่" : "ไม่", e.isActive() ? "ใช่" : "ไม่"))).append("\r\n");
        }
        return sb.toString();
    }

    public record ImportResult(int created, int updated, List<String> errors) {}

    /**
     * Rows with an id that exists are updated, others are added. The first row is the header.
     * Columns: id, หมวด, คำถาม, คำถามแบบอื่น, คำตอบ, ตอบตามนี้เป๊ะ, เปิดใช้ (the id may be left empty).
     */
    @Transactional
    public ImportResult importCsv(String csv) {
        List<List<String>> rows = parseCsv(csv == null ? "" : csv.replace("﻿", ""));
        int created = 0, updated = 0;
        List<String> errors = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            if (r.stream().allMatch(String::isBlank)) continue;
            String cell0 = cell(r, 0);
            FaqEntry input = FaqEntry.builder()
                    .category(cell(r, 1)).question(cell(r, 2)).alternatives(cell(r, 3)).answer(cell(r, 4))
                    .exactAnswer(yes(cell(r, 5), true)).active(yes(cell(r, 6), true)).build();
            try {
                Long id = cell0.matches("\\d+") ? Long.valueOf(cell0) : null;
                if (id != null && repository.existsById(id)) {
                    update(id, input);
                    updated++;
                } else {
                    create(input);
                    created++;
                }
            } catch (ResponseStatusException ex) {
                errors.add("แถวที่ " + (i + 1) + ": " + ex.getReason());
            }
        }
        return new ImportResult(created, updated, errors);
    }

    private static String cell(List<String> r, int i) {
        return i < r.size() ? r.get(i).trim() : "";
    }

    private static boolean yes(String v, boolean whenEmpty) {
        if (v.isBlank()) return whenEmpty;
        String s = v.trim().toLowerCase(Locale.ROOT);
        return s.equals("ใช่") || s.equals("y") || s.equals("yes") || s.equals("true") || s.equals("1");
    }

    private static String csvCell(String v) {
        String s = v == null ? "" : v;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }

    /** RFC 4180: quoted cells may hold commas, quotes ("") and line breaks */
    static List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') { cur.append('"'); i++; }
                else if (c == '"') quoted = false;
                else cur.append(c);
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                row.add(cur.toString()); cur.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                row.add(cur.toString()); cur.setLength(0);
                rows.add(row); row = new ArrayList<>();
            } else {
                cur.append(c);
            }
        }
        if (cur.length() > 0 || !row.isEmpty()) { row.add(cur.toString()); rows.add(row); }
        return rows;
    }
}
