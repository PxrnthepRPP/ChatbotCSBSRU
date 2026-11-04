package com.bsru.studentportal.service;

import com.bsru.studentportal.model.ChatHistoryAccess;
import com.bsru.studentportal.model.ChatHistoryEntry;
import com.bsru.studentportal.model.ChatLogEntry;
import com.bsru.studentportal.model.FaqEntry;
import com.bsru.studentportal.model.SatisfactionRating;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.ChatHistoryAccessRepository;
import com.bsru.studentportal.repository.ChatHistoryRepository;
import com.bsru.studentportal.repository.ChatLogRepository;
import com.bsru.studentportal.repository.FaqEntryRepository;
import com.bsru.studentportal.repository.SatisfactionRatingRepository;
import com.bsru.studentportal.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * The permanent chat archive (chat_log_entries), who may read their own past chats,
 * satisfaction ratings, and the admin's usage statistics.
 * Chats are only ever returned for one person at a time.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatLogService {

    public static final List<String> ROLES = List.of("STUDENT", "ADVISOR", "ADMIN", "GUEST");
    /** The demo "advisor" login sees every student; its chats belong to the same advisor */
    private static final String SEES_ALL_SUFFIX = ":all";
    private static final int AI_RECALL_MESSAGES = 20;
    private static final int AI_RECALL_CHARS = 300;
    private static final int OWN_ARCHIVE_LIMIT = 500;
    private static final DateTimeFormatter RECALL_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final ChatLogRepository logRepository;
    private final ChatHistoryRepository historyRepository;
    private final ChatHistoryAccessRepository accessRepository;
    private final SatisfactionRatingRepository ratingRepository;
    private final FaqEntryRepository faqRepository;
    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;

    // ------------------------------------------------------------------ identity

    /** "advisor:ADV-01:all" and "advisor:ADV-01" are the same person */
    public static String personKey(String chatKey) {
        if (chatKey == null) return "";
        return chatKey.endsWith(SEES_ALL_SUFFIX) ? chatKey.substring(0, chatKey.length() - SEES_ALL_SUFFIX.length()) : chatKey;
    }

    public static String roleOf(String personKey) {
        if (personKey.startsWith("student:")) return "STUDENT";
        if (personKey.startsWith("advisor:")) return "ADVISOR";
        if (personKey.startsWith("staff:")) return "ADMIN";
        return "GUEST";
    }

    // ------------------------------------------------------------------ recording

    /** Saves one message; never throws (the chat must answer even if the archive is down) */
    public ChatLogEntry record(String chatKey, String sender, String message, ChatLogEntry.Source source, Long faqId) {
        try {
            String person = personKey(chatKey);
            return logRepository.save(ChatLogEntry.builder()
                    .personKey(person).role(roleOf(person)).sender(sender).message(message)
                    .source(source != null ? source.name() : null).faqId(faqId)
                    .createdAt(LocalDateTime.now()).build());
        } catch (Exception e) {
            log.warn("Failed to archive chat message for {}: {}", chatKey, e.getMessage());
            return null;
        }
    }

    /** Marks how the question was answered, once the answer is known */
    public void markAnswered(ChatLogEntry question, ChatLogEntry.Source source, Long faqId) {
        if (question == null) return;
        try {
            question.setSource(source.name());
            question.setFaqId(faqId);
            logRepository.save(question);
        } catch (Exception e) {
            log.warn("Failed to update archived question {}: {}", question.getId(), e.getMessage());
        }
    }

    /**
     * The person's chats from before the current conversation (the panel is emptied on every login),
     * for the AI to recall. Empty when there are none.
     */
    @Transactional(readOnly = true)
    public String recallForAi(String chatKey) {
        try {
            LocalDateTime sessionStart = historyRepository.findByUserKeyOrderByTimestampAsc(chatKey).stream()
                    .map(ChatHistoryEntry::getTimestamp).filter(Objects::nonNull).findFirst()
                    .orElse(LocalDateTime.now());
            List<ChatLogEntry> older = new ArrayList<>(logRepository.findByPersonKeyAndCreatedAtBeforeOrderByCreatedAtDesc(
                    personKey(chatKey), sessionStart, PageRequest.of(0, AI_RECALL_MESSAGES)));
            if (older.isEmpty()) return "";
            Collections.reverse(older);
            StringBuilder sb = new StringBuilder();
            for (ChatLogEntry e : older) {
                String text = e.getMessage().length() > AI_RECALL_CHARS ? e.getMessage().substring(0, AI_RECALL_CHARS) + "…" : e.getMessage();
                sb.append('[').append(e.getCreatedAt().format(RECALL_TIME)).append("] ")
                        .append(ChatLogEntry.USER.equals(e.getSender()) ? "ผู้ใช้: " : "AI: ")
                        .append(text.replace('\n', ' ')).append('\n');
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("Could not load earlier chats for {}: {}", chatKey, e.getMessage());
            return "";
        }
    }

    // ------------------------------------------------------------------ who may see their own past chats

    public record AccessSettings(Map<String, Boolean> roles, List<PersonAccess> people) {}

    public record PersonAccess(String personKey, String role, String displayName, boolean allowed) {}

    @Transactional(readOnly = true)
    public boolean canSeeOwnHistory(String chatKey) {
        String person = personKey(chatKey);
        return accessRepository.findById("person:" + person).map(ChatHistoryAccess::isAllowed)
                .orElseGet(() -> accessRepository.findById("role:" + roleOf(person)).map(ChatHistoryAccess::isAllowed).orElse(false));
    }

    /** The person's own archive, oldest first, only if the admin allowed it */
    @Transactional(readOnly = true)
    public List<ChatLogEntry> ownArchive(String chatKey) {
        if (!canSeeOwnHistory(chatKey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ผู้ดูแลระบบยังไม่ได้เปิดให้คุณดูประวัติแชทย้อนหลัง");
        }
        List<ChatLogEntry> all = logRepository.findByPersonKeyOrderByCreatedAtAsc(personKey(chatKey));
        return all.size() > OWN_ARCHIVE_LIMIT ? all.subList(all.size() - OWN_ARCHIVE_LIMIT, all.size()) : all;
    }

    @Transactional(readOnly = true)
    public AccessSettings accessSettings() {
        Map<String, Boolean> roles = new LinkedHashMap<>();
        for (String r : ROLES) roles.put(r, accessRepository.findById("role:" + r).map(ChatHistoryAccess::isAllowed).orElse(false));
        List<PersonAccess> people = accessRepository.findByAccessKeyStartingWith("person:").stream()
                .map(a -> {
                    String person = a.getAccessKey().substring("person:".length());
                    return new PersonAccess(person, roleOf(person), displayName(person), a.isAllowed());
                })
                .sorted(Comparator.comparing(PersonAccess::personKey)).toList();
        return new AccessSettings(roles, people);
    }

    @Transactional
    public void setRoleAccess(String role, boolean allowed) {
        if (!ROLES.contains(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ไม่รู้จักบทบาท " + role);
        accessRepository.save(new ChatHistoryAccess("role:" + role, allowed, LocalDateTime.now()));
    }

    /** allowed = null removes the person's override so the role default applies again */
    @Transactional
    public void setPersonAccess(String personKey, Boolean allowed) {
        String person = personKey(personKey == null ? "" : personKey.trim());
        if (!person.matches("(student|advisor|staff|guest):[A-Za-z0-9._-]{1,64}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "รูปแบบผู้ใช้ไม่ถูกต้อง เช่น student:6421100042 หรือ advisor:ADV-01");
        }
        if (allowed == null) accessRepository.deleteById("person:" + person);
        else accessRepository.save(new ChatHistoryAccess("person:" + person, allowed, LocalDateTime.now()));
    }

    // ------------------------------------------------------------------ satisfaction

    @Transactional
    public void rate(String chatKey, int level, String trigger) {
        if (level < 1 || level > 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ระดับความพึงพอใจต้องเป็น 1–3");
        String person = personKey(chatKey);
        String t = "CLOSE".equalsIgnoreCase(trigger) ? "CLOSE" : "IDLE";
        ratingRepository.save(SatisfactionRating.builder()
                .personKey(person).role(roleOf(person)).level(level).trigger(t).createdAt(LocalDateTime.now()).build());
    }

    // ------------------------------------------------------------------ admin: people and their chats

    public record PersonSummary(String personKey, String role, String displayName, long questions, LocalDateTime lastAt,
                                Boolean override, boolean canSeeOwnHistory) {}

    @Transactional(readOnly = true)
    public List<PersonSummary> people(String search) {
        String q = search == null ? "" : search.trim().toLowerCase();
        Map<String, Boolean> overrides = accessRepository.findByAccessKeyStartingWith("person:").stream()
                .collect(Collectors.toMap(a -> a.getAccessKey().substring("person:".length()), ChatHistoryAccess::isAllowed));
        Map<String, Boolean> roleDefaults = accessSettings().roles();
        List<PersonSummary> out = new ArrayList<>();
        for (Object[] row : logRepository.summarizePeople()) {
            String person = (String) row[0];
            String name = displayName(person);
            if (!q.isEmpty() && !person.toLowerCase().contains(q) && !name.toLowerCase().contains(q)) continue;
            Boolean override = overrides.get(person);
            boolean sees = override != null ? override : roleDefaults.getOrDefault((String) row[1], false);
            out.add(new PersonSummary(person, (String) row[1], name, ((Number) row[2]).longValue(), (LocalDateTime) row[3], override, sees));
        }
        return out;
    }

    /** One person's whole archive, oldest first (the admin page reads one person at a time) */
    @Transactional(readOnly = true)
    public List<ChatLogEntry> personLog(String personKey) {
        return logRepository.findByPersonKeyOrderByCreatedAtAsc(personKey(personKey));
    }

    private String displayName(String person) {
        try {
            if (person.startsWith("student:")) {
                String id = person.substring("student:".length());
                return studentRepository.findById(id).map(s -> id + " " + s.getNameTh()).orElse(id);
            }
            if (person.startsWith("advisor:")) {
                String id = person.substring("advisor:".length());
                return advisorRepository.findById(id).map(a -> id + " " + a.getNameTh()).orElse(id);
            }
            if (person.startsWith("staff:")) return "ผู้ดูแลระบบ (" + person.substring("staff:".length()) + ")";
            return "ผู้ใช้ทั่วไป " + person.substring(person.indexOf(':') + 1, Math.min(person.length(), person.indexOf(':') + 9)) + "…";
        } catch (Exception e) {
            return person;
        }
    }

    // ------------------------------------------------------------------ admin: statistics

    public record QuestionStat(String question, long count, LocalDateTime lastAt, String lastSource) {}

    public record DayCount(LocalDate date, long count) {}

    public record FaqHit(Long id, String category, String question, long hitCount, LocalDateTime lastHitAt) {}

    public record SatisfactionStats(long total, Map<Integer, Long> byLevel, Double average,
                                    Map<String, Map<Integer, Long>> byRole, List<DayCount> perDay) {}

    public record Analytics(int days, long questions, long people, Map<String, Long> byRole, Map<String, Long> bySource,
                            List<DayCount> perDay, long[] perHour, List<QuestionStat> topQuestions,
                            List<QuestionStat> unanswered, List<FaqHit> topFaqs, SatisfactionStats satisfaction) {}

    @Transactional(readOnly = true)
    public Analytics analytics(int days) {
        int span = Math.max(1, Math.min(days, 365));
        LocalDateTime since = LocalDate.now().minusDays(span - 1L).atStartOfDay();
        List<ChatLogEntry> questions = logRepository.findByCreatedAtAfter(since).stream()
                .filter(e -> ChatLogEntry.USER.equals(e.getSender())).toList();

        Map<String, Long> byRole = new LinkedHashMap<>();
        ROLES.forEach(r -> byRole.put(r, 0L));
        questions.forEach(e -> byRole.merge(e.getRole(), 1L, Long::sum));

        Map<String, Long> bySource = new LinkedHashMap<>();
        for (ChatLogEntry.Source s : ChatLogEntry.Source.values()) bySource.put(s.name(), 0L);
        questions.forEach(e -> bySource.merge(e.getSource() != null ? e.getSource() : ChatLogEntry.Source.AI.name(), 1L, Long::sum));

        long[] perHour = new long[24];
        questions.forEach(e -> perHour[e.getCreatedAt().getHour()]++);

        return new Analytics(span, questions.size(),
                questions.stream().map(ChatLogEntry::getPersonKey).distinct().count(),
                byRole, bySource, perDay(questions.stream().map(ChatLogEntry::getCreatedAt).toList(), since.toLocalDate()),
                perHour, groupQuestions(questions, Set.of()),
                groupQuestions(questions, Set.of(ChatLogEntry.Source.NO_ANSWER.name())),
                topFaqs(), satisfaction(since));
    }

    /** Same question asked in different spacing/politeness counts together */
    private static List<QuestionStat> groupQuestions(List<ChatLogEntry> questions, Set<String> onlySources) {
        Map<String, List<ChatLogEntry>> groups = new LinkedHashMap<>();
        for (ChatLogEntry e : questions) {
            if (!onlySources.isEmpty() && !onlySources.contains(e.getSource())) continue;
            String key = FaqService.normalize(e.getMessage());
            if (key.isEmpty()) continue;
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }
        return groups.values().stream()
                .map(list -> {
                    ChatLogEntry last = list.stream().max(Comparator.comparing(ChatLogEntry::getCreatedAt)).orElseThrow();
                    String text = last.getMessage().length() > 300 ? last.getMessage().substring(0, 300) + "…" : last.getMessage();
                    return new QuestionStat(text, list.size(), last.getCreatedAt(), last.getSource());
                })
                .sorted(Comparator.comparingLong(QuestionStat::count).reversed().thenComparing(QuestionStat::lastAt, Comparator.reverseOrder()))
                .limit(20).toList();
    }

    private static List<DayCount> perDay(List<LocalDateTime> times, LocalDate from) {
        Map<LocalDate, Long> counts = new TreeMap<>();
        for (LocalDate d = from; !d.isAfter(LocalDate.now()); d = d.plusDays(1)) counts.put(d, 0L);
        times.forEach(t -> counts.merge(t.toLocalDate(), 1L, Long::sum));
        return counts.entrySet().stream().map(e -> new DayCount(e.getKey(), e.getValue())).toList();
    }

    private List<FaqHit> topFaqs() {
        return faqRepository.findAll().stream()
                .filter(f -> f.getHitCount() > 0)
                .sorted(Comparator.comparingLong(FaqEntry::getHitCount).reversed())
                .limit(10)
                .map(f -> new FaqHit(f.getId(), f.getCategory(), f.getQuestion(), f.getHitCount(), f.getLastHitAt()))
                .toList();
    }

    private SatisfactionStats satisfaction(LocalDateTime since) {
        List<SatisfactionRating> ratings = ratingRepository.findByCreatedAtAfter(since);
        Map<Integer, Long> byLevel = new LinkedHashMap<>(Map.of(1, 0L, 2, 0L, 3, 0L));
        Map<String, Map<Integer, Long>> byRole = new LinkedHashMap<>();
        for (String r : ROLES) byRole.put(r, new LinkedHashMap<>(Map.of(1, 0L, 2, 0L, 3, 0L)));
        ratings.forEach(r -> {
            byLevel.merge(r.getLevel(), 1L, Long::sum);
            byRole.computeIfAbsent(r.getRole(), k -> new LinkedHashMap<>(Map.of(1, 0L, 2, 0L, 3, 0L))).merge(r.getLevel(), 1L, Long::sum);
        });
        Double avg = ratings.isEmpty() ? null : ratings.stream().mapToInt(SatisfactionRating::getLevel).average().orElse(0);
        return new SatisfactionStats(ratings.size(), new TreeMap<>(byLevel), avg, byRole,
                perDay(ratings.stream().map(SatisfactionRating::getCreatedAt).toList(), since.toLocalDate()));
    }
}
