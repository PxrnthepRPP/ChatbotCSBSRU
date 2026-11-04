package com.bsru.studentportal.security;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.config.SecurityConfig;
import com.bsru.studentportal.controller.ChatController;
import com.bsru.studentportal.model.ChatHistoryEntry;
import com.bsru.studentportal.repository.ChatHistoryRepository;
import com.bsru.studentportal.service.AcademicFormCatalogService;
import com.bsru.studentportal.service.GeminiDirectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import dev.langchain4j.store.memory.chat.InMemoryChatMemoryStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET/DELETE /api/chat/history and POST /api/chat through the real security filter chain:
 * a caller can only reach their own chat history. Logged-in users are identified by the JWT only,
 * guests only by their own random per-tab id (namespaced as guest:&lt;id&gt;).
 */
@WebMvcTest(controllers = ChatController.class)
@AutoConfigureMockMvc(addFilters = true)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtUtil.class,
        ChatHistoryAuthorizationTest.MemoryStoreConfig.class})
@TestPropertySource(properties = "gemini.api.key=demo-api-key")
@DisplayName("Chat history authorization (IDOR) tests")
class ChatHistoryAuthorizationTest {

    @TestConfiguration
    static class MemoryStoreConfig {
        @Bean
        ChatMemoryStore chatMemoryStore() {
            return new InMemoryChatMemoryStore();
        }
    }

    private static final String STUDENT_A = "6621100042";
    private static final String STUDENT_B = "6621100099";

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ChatMemoryStore chatMemoryStore;

    @MockBean private ChatHistoryRepository chatHistoryRepository;
    @MockBean private GeminiDirectService geminiDirectService;
    @MockBean private StudentRecordTools studentRecordTools;
    @MockBean private AdvisorTools advisorTools;
    @MockBean private com.bsru.studentportal.ai.TeachingTools teachingTools;
    @MockBean private ContentRetriever contentRetriever;
    @MockBean private AcademicFormCatalogService academicFormCatalogService;

    /** In-memory stand-in for the chat_history_entries table. */
    private final List<ChatHistoryEntry> table = new CopyOnWriteArrayList<>();
    private final AtomicLong ids = new AtomicLong(1);
    /** The chat endpoint is rate limited per IP (15/min); give every request its own address. */
    private static final AtomicInteger REMOTE_ADDR_SEQ = new AtomicInteger(1);

    private String studentAToken;
    private String studentBToken;

    @BeforeEach
    void setUp() {
        table.clear();
        chatMemoryStore.deleteMessages("student:" + STUDENT_A);
        chatMemoryStore.deleteMessages("student:" + STUDENT_B);
        studentAToken = jwtUtil.generateToken(STUDENT_A, "ROLE_STUDENT", Map.of());
        studentBToken = jwtUtil.generateToken(STUDENT_B, "ROLE_STUDENT", Map.of());

        when(chatHistoryRepository.save(any(ChatHistoryEntry.class))).thenAnswer(inv -> {
            ChatHistoryEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(ids.getAndIncrement());
            if (e.getTimestamp() == null) e.setTimestamp(LocalDateTime.now());
            table.add(e);
            return e;
        });
        when(chatHistoryRepository.findByUserKeyOrderByTimestampAsc(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            return table.stream().filter(e -> key.equals(e.getUserKey()))
                    .sorted(Comparator.comparing(ChatHistoryEntry::getTimestamp)).toList();
        });
        when(chatHistoryRepository.findBySessionIdOrUserKeyOrderByTimestampAsc(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            return table.stream().filter(e -> key.equals(e.getSessionId()) || key.equals(e.getUserKey()))
                    .sorted(Comparator.comparing(ChatHistoryEntry::getTimestamp)).toList();
        });
        when(chatHistoryRepository.deleteByUserKey(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            int before = table.size();
            table.removeIf(e -> key.equals(e.getUserKey()));
            return before - table.size();
        });
        when(chatHistoryRepository.deleteBySessionIdOrUserKey(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            int before = table.size();
            table.removeIf(e -> key.equals(e.getSessionId()) || key.equals(e.getUserKey()));
            return before - table.size();
        });
        when(chatHistoryRepository.deleteBySessionId(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            int before = table.size();
            table.removeIf(e -> key.equals(e.getSessionId()));
            return before - table.size();
        });
    }

    // ------------------------------------------------------------------ helpers

    private static MockHttpServletRequestBuilder fromNewAddress(MockHttpServletRequestBuilder builder) {
        int n = REMOTE_ADDR_SEQ.getAndIncrement();
        return builder.with(req -> {
            req.setRemoteAddr("10.77." + (n / 250) + "." + (n % 250 + 1));
            return req;
        });
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return token == null ? builder : builder.header("Authorization", "Bearer " + token);
    }

    /** POST /api/chat; returns the response JSON. */
    private JsonNode chat(String token, String message, String sessionId) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        if (sessionId != null) body.put("sessionId", sessionId);
        String json = mockMvc.perform(fromNewAddress(withToken(post("/api/chat"), token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(json);
    }

    private List<String> historyMessages(String token, String query) throws Exception {
        String json = mockMvc.perform(fromNewAddress(withToken(get("/api/chat/history" + query), token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<String> messages = new ArrayList<>();
        objectMapper.readTree(json).forEach(n -> messages.add(n.path("message").asText()));
        return messages;
    }

    private long rowsFor(String key) {
        return table.stream().filter(e -> key.equals(e.getUserKey())).count();
    }

    // ------------------------------------------------------------------ tests

    @Test
    @DisplayName("Unauthenticated caller cannot read student 6621100042's history by any identifier")
    void unauthenticatedCannotReadStudentHistory() throws Exception {
        chat(studentAToken, "ข้อความลับของนักศึกษา A", null);
        assertEquals(2, rowsFor("student:" + STUDENT_A));

        // the identifiers that used to work (raw username / student key) are rejected outright
        for (String query : List.of("?sessionId=" + STUDENT_A, "?userKey=" + STUDENT_A,
                "?sessionId=student:" + STUDENT_A, "?userKey=student:" + STUDENT_A,
                "?sessionId=student_guest", "?sessionId=guest-session")) {
            String body = mockMvc.perform(fromNewAddress(get("/api/chat/history" + query)))
                    .andExpect(status().isBadRequest())
                    .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            assertFalse(body.contains("ข้อความลับ"), "must not leak for " + query);
        }

        // a well-formed guest id only ever addresses guest:<id>
        assertTrue(historyMessages(null, "?sessionId=" + STUDENT_A + "-padding-xyz").isEmpty());
        // no id at all -> nothing
        assertTrue(historyMessages(null, "").isEmpty());
    }

    @Test
    @DisplayName("Unauthenticated caller cannot delete student 6621100042's history")
    void unauthenticatedCannotDeleteStudentHistory() throws Exception {
        chat(studentAToken, "ประวัติที่ต้องไม่ถูกลบ", null);

        for (String query : List.of("?sessionId=" + STUDENT_A, "?userKey=" + STUDENT_A,
                "?sessionId=student:" + STUDENT_A, "?userKey=student:" + STUDENT_A)) {
            mockMvc.perform(fromNewAddress(delete("/api/chat/history" + query)))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(fromNewAddress(delete("/api/chat/history")))
                .andExpect(status().isOk());

        assertEquals(2, rowsFor("student:" + STUDENT_A), "student history must survive anonymous deletes");
        assertTrue(historyMessages(studentAToken, "").contains("ประวัติที่ต้องไม่ถูกลบ"));
    }

    @Test
    @DisplayName("Student A cannot read or delete student B's history")
    void studentCannotAccessAnotherStudentsHistory() throws Exception {
        chat(studentBToken, "คำถามส่วนตัวของนักศึกษา B", null);
        chat(studentAToken, "คำถามของนักศึกษา A", null);

        List<String> seenByA = historyMessages(studentAToken,
                "?sessionId=" + STUDENT_B + "&userKey=student:" + STUDENT_B);
        assertFalse(seenByA.isEmpty());
        assertTrue(seenByA.stream().noneMatch(m -> m.contains("นักศึกษา B")), "A must not see B's messages");
        assertTrue(seenByA.contains("คำถามของนักศึกษา A"));

        // A's delete aimed at B only clears A's own history
        mockMvc.perform(fromNewAddress(withToken(delete("/api/chat/history?userKey=student:" + STUDENT_B
                        + "&sessionId=" + STUDENT_B), studentAToken)))
                .andExpect(status().isOk());
        assertEquals(2, rowsFor("student:" + STUDENT_B), "B's history must be untouched");
        assertEquals(0, rowsFor("student:" + STUDENT_A));

        // A cannot write into B's history or memory by passing B's id either
        chat(studentAToken, "พยายามเขียนลงห้องของ B", "student:" + STUDENT_B);
        assertEquals(2, rowsFor("student:" + STUDENT_B));
        assertTrue(chatMemoryStore.getMessages("student:" + STUDENT_B).stream()
                .noneMatch(m -> m.toString().contains("พยายามเขียน")));
    }

    @Test
    @DisplayName("Two guests never see each other's history")
    void guestsAreIsolated() throws Exception {
        String guest1 = UUID.randomUUID().toString();
        String guest2 = UUID.randomUUID().toString();

        JsonNode r1 = chat(null, "คำถามของ guest หนึ่ง", guest1);
        JsonNode r2 = chat(null, "คำถามของ guest สอง", guest2);
        assertEquals(guest1, r1.path("sessionId").asText());
        assertEquals(guest2, r2.path("sessionId").asText());

        List<String> seenBy2 = historyMessages(null, "?sessionId=" + guest2);
        assertTrue(seenBy2.contains("คำถามของ guest สอง"));
        assertTrue(seenBy2.stream().noneMatch(m -> m.contains("guest หนึ่ง")));

        // guests without an id are not lumped into a shared "guest-session"
        JsonNode anon1 = chat(null, "ไม่มี id คนแรก", null);
        JsonNode anon2 = chat(null, "ไม่มี id คนที่สอง", null);
        String anonId1 = anon1.path("sessionId").asText();
        String anonId2 = anon2.path("sessionId").asText();
        assertNotEquals(anonId1, anonId2);
        assertTrue(anonId1.matches("[A-Za-z0-9-]{16,64}"));
        List<String> seenByAnon2 = historyMessages(null, "?sessionId=" + anonId2);
        assertTrue(seenByAnon2.stream().noneMatch(m -> m.contains("คนแรก")));
        assertEquals(0, rowsFor("guest:guest-session"));

        // a guest asking for a student's key gets a fresh id instead
        JsonNode spoof = chat(null, "แอบอ้างเป็นนักศึกษา", "student:" + STUDENT_A);
        assertNotEquals("student:" + STUDENT_A, spoof.path("sessionId").asText());
        assertEquals(0, rowsFor("student:" + STUDENT_A));
        assertTrue(chatMemoryStore.getMessages("student:" + STUDENT_A).isEmpty());

        // guest 2 clearing only clears guest 2
        mockMvc.perform(fromNewAddress(delete("/api/chat/history?sessionId=" + guest2)))
                .andExpect(status().isOk());
        assertEquals(0, rowsFor("guest:" + guest2));
        assertEquals(2, rowsFor("guest:" + guest1));
    }

    @Test
    @DisplayName("A logged-in student still sees and clears their own history")
    void loggedInUserSeesOwnHistory() throws Exception {
        JsonNode response = chat(studentAToken, "สวัสดีครับ", "6621100042");
        assertEquals("student:" + STUDENT_A, response.path("sessionId").asText());

        // legacy row written by the old frontend (session_id = raw username, user_key from the JWT)
        table.add(ChatHistoryEntry.builder().id(ids.getAndIncrement())
                .sessionId(STUDENT_A).userKey("student:" + STUDENT_A)
                .sender("USER").message("ข้อความเก่าก่อนย้ายระบบ")
                .timestamp(LocalDateTime.now().minusDays(1)).build());

        List<String> own = historyMessages(studentAToken, "");
        assertEquals(3, own.size());
        assertEquals("ข้อความเก่าก่อนย้ายระบบ", own.get(0));
        assertTrue(own.contains("สวัสดีครับ"));
        // passing a sessionId changes nothing for a logged-in user
        assertEquals(own, historyMessages(studentAToken, "?sessionId=whatever-client-value-123"));

        mockMvc.perform(fromNewAddress(withToken(delete("/api/chat/history"), studentAToken)))
                .andExpect(status().isOk());
        assertTrue(historyMessages(studentAToken, "").isEmpty());
        assertTrue(chatMemoryStore.getMessages("student:" + STUDENT_A).isEmpty());
    }
}
