package com.bsru.studentportal.controller;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.model.ChatHistoryEntry;
import com.bsru.studentportal.repository.ChatHistoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Empirical Adversarial & Stress Harness for Chat History Persistence and Clear Functionality (Milestone 3 / WP-3)
 *
 * Validates:
 * 1. Dual-message persistence (USER and BOT) across both fallback and AI execution branches.
 * 2. Strict session isolation: no cross-session message leakage between users or anonymous guests.
 * 3. Retrieval ordering via GET /api/chat/history in chronological ascending sequence.
 * 4. Contract compliance: JSON serialization of role ("user"/"bot"), messageText, and createdAt.
 * 5. Complete history clearance via DELETE /api/chat/history purging database entries and memory store.
 * 6. High-concurrency thread safety, rapid sequential requests, and non-blocking read-while-write.
 * 7. Fault-tolerant fail-open behavior when the database layer encounters an exception.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatHistoryPersistenceAdversarialTest {

    @Mock
    private ContentRetriever contentRetriever;

    @Mock
    private ChatMemoryStore chatMemoryStore;

    @Mock
    private StudentRecordTools studentRecordTools;

    @Mock
    private AdvisorTools advisorTools;

    @Mock
    private ChatHistoryRepository chatHistoryRepository;

    @InjectMocks
    private ChatController chatController;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    // In-memory thread-safe simulation of ChatHistoryRepository table storage
    private final List<ChatHistoryEntry> inMemoryHistoryTable = new CopyOnWriteArrayList<>();
    private final ConcurrentMap<String, List<ChatMessage>> inMemoryChatMemory = new ConcurrentHashMap<>();
    private final AtomicLong idSequence = new AtomicLong(1);

    private Authentication studentAuth;
    private Authentication otherStudentAuth;

    @BeforeEach
    void setUp() {
        inMemoryHistoryTable.clear();
        inMemoryChatMemory.clear();
        idSequence.set(1);

        // Default to fallback mode unless a test specifically overrides
        ReflectionTestUtils.setField(chatController, "geminiApiKey", "demo-api-key");

        // Wire thread-safe storage behavior into mock ChatHistoryRepository
        when(chatHistoryRepository.save(any(ChatHistoryEntry.class))).thenAnswer(invocation -> {
            ChatHistoryEntry entry = invocation.getArgument(0);
            if (entry.getId() == null) {
                entry.setId(idSequence.getAndIncrement());
            }
            if (entry.getTimestamp() == null) {
                entry.setTimestamp(LocalDateTime.now());
            }
            inMemoryHistoryTable.add(entry);
            return entry;
        });

        when(chatHistoryRepository.findBySessionIdOrUserKeyOrderByTimestampAsc(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            return inMemoryHistoryTable.stream()
                    .filter(e -> key.equals(e.getSessionId()) || key.equals(e.getUserKey()))
                    .sorted(Comparator.comparing(ChatHistoryEntry::getTimestamp))
                    .collect(Collectors.toList());
        });

        when(chatHistoryRepository.findBySessionIdOrderByTimestampAsc(anyString())).thenAnswer(invocation -> {
            String sessionId = invocation.getArgument(0);
            return inMemoryHistoryTable.stream()
                    .filter(e -> sessionId.equals(e.getSessionId()))
                    .sorted(Comparator.comparing(ChatHistoryEntry::getTimestamp))
                    .collect(Collectors.toList());
        });

        when(chatHistoryRepository.findByUserKeyOrderByTimestampAsc(anyString())).thenAnswer(invocation -> {
            String userKey = invocation.getArgument(0);
            return inMemoryHistoryTable.stream()
                    .filter(e -> userKey.equals(e.getUserKey()))
                    .sorted(Comparator.comparing(ChatHistoryEntry::getTimestamp))
                    .collect(Collectors.toList());
        });

        when(chatHistoryRepository.deleteBySessionIdOrUserKey(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            int before = inMemoryHistoryTable.size();
            inMemoryHistoryTable.removeIf(e -> key.equals(e.getSessionId()) || key.equals(e.getUserKey()));
            return before - inMemoryHistoryTable.size();
        });

        when(chatHistoryRepository.deleteBySessionId(anyString())).thenAnswer(invocation -> {
            String sessionId = invocation.getArgument(0);
            int before = inMemoryHistoryTable.size();
            inMemoryHistoryTable.removeIf(e -> sessionId.equals(e.getSessionId()));
            return before - inMemoryHistoryTable.size();
        });

        when(chatHistoryRepository.deleteByUserKey(anyString())).thenAnswer(invocation -> {
            String userKey = invocation.getArgument(0);
            int before = inMemoryHistoryTable.size();
            inMemoryHistoryTable.removeIf(e -> userKey.equals(e.getUserKey()));
            return before - inMemoryHistoryTable.size();
        });

        // Wire thread-safe storage behavior into mock ChatMemoryStore
        when(chatMemoryStore.getMessages(anyString())).thenAnswer(invocation -> {
            String session = invocation.getArgument(0);
            return inMemoryChatMemory.getOrDefault(session, new ArrayList<>());
        });

        doAnswer(invocation -> {
            String session = invocation.getArgument(0);
            List<ChatMessage> msgs = invocation.getArgument(1);
            inMemoryChatMemory.put(session, new ArrayList<>(msgs));
            return null;
        }).when(chatMemoryStore).updateMessages(anyString(), any());

        doAnswer(invocation -> {
            String session = invocation.getArgument(0);
            inMemoryChatMemory.remove(session);
            return null;
        }).when(chatMemoryStore).deleteMessages(anyString());

        // Setup test authentications
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6421100042", "password", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        otherStudentAuth = new UsernamePasswordAuthenticationToken(
                "6421100099", "password", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }

    // =========================================================================
    // 1. DUAL-MESSAGE PERSISTENCE & DATA INTEGRITY
    // =========================================================================

    @Test
    @DisplayName("Empirical: Each chat interaction persists exactly 2 records (USER and BOT) in fallback mode")
    void testChatInteractionPersistsUserAndBotRecordsInFallbackMode() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดีครับ มีคำถามเรื่องการยื่นคำร้อง");
        req.setSessionId("test-session-001");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, inMemoryHistoryTable.size(), "Database must contain exactly 1 USER and 1 BOT record");

        ChatHistoryEntry userEntry = inMemoryHistoryTable.get(0);
        assertEquals("USER", userEntry.getSender());
        assertEquals("user", userEntry.getRole());
        assertEquals("สวัสดีครับ มีคำถามเรื่องการยื่นคำร้อง", userEntry.getMessage());
        // logged-in: key comes from the JWT, the client-supplied sessionId is ignored
        assertEquals("student:6421100042", userEntry.getSessionId());
        assertEquals("student:6421100042", userEntry.getUserKey());
        assertNull(userEntry.getSources(), "User query must have null sources");
        assertNotNull(userEntry.getTimestamp());

        ChatHistoryEntry botEntry = inMemoryHistoryTable.get(1);
        assertEquals("BOT", botEntry.getSender());
        assertEquals("bot", botEntry.getRole());
        assertNotNull(botEntry.getMessage());
        assertTrue(botEntry.getMessage().contains("คำร้องวิชาการ"), "Fallback message should contain relevant guidance");
        assertEquals("student:6421100042", botEntry.getSessionId());
        assertEquals("student:6421100042", botEntry.getUserKey());
        assertNotNull(botEntry.getTimestamp());
    }

    @Test
    @DisplayName("Empirical: BOT record correctly serializes and stores RAG sources in database")
    void testBotRecordStoresRagSourcesAsJson() {
        Content c1 = Content.from(TextSegment.from("ข้อบังคับ 2569", Metadata.from("source", "curriculum_standard_2569.pdf")));
        when(contentRetriever.retrieve(any(Query.class))).thenReturn(List.of(c1));

        ChatRequest req = new ChatRequest();
        req.setMessage("เกณฑ์การสำเร็จการศึกษา");
        req.setSessionId("session-rag-test");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        assertEquals(2, inMemoryHistoryTable.size());
        ChatHistoryEntry botEntry = inMemoryHistoryTable.get(1);
        assertEquals("BOT", botEntry.getSender());
        assertNotNull(botEntry.getSources(), "Sources JSON must not be null when RAG chunks are retrieved");
        assertTrue(botEntry.getSources().contains("curriculum_standard_2569.pdf"),
                "Stored sources JSON must contain the document name");
    }

    @Test
    @DisplayName("Empirical: ChatHistoryEntry Jackson aliases (role, messageText, createdAt) serialize properly")
    void testChatHistoryEntryJacksonSerialization() throws Exception {
        LocalDateTime now = LocalDateTime.now();
        ChatHistoryEntry entry = ChatHistoryEntry.builder()
                .id(42L)
                .sessionId("sess-json-01")
                .userKey("student:6421100042")
                .sender("USER")
                .message("ทดสอบ JSON")
                .sources("[\"doc1.pdf\"]")
                .timestamp(now)
                .build();

        String json = OBJECT_MAPPER.writeValueAsString(entry);
        Map<String, Object> map = OBJECT_MAPPER.readValue(json, new TypeReference<>() {});

        // Direct fields
        assertEquals("USER", map.get("sender"));
        assertEquals("ทดสอบ JSON", map.get("message"));

        // Backward / Frontend aliases
        assertEquals("user", map.get("role"), "Jackson alias 'role' must be lowercase 'user'");
        assertEquals("ทดสอบ JSON", map.get("messageText"), "Jackson alias 'messageText' must match message");
        assertNotNull(map.get("createdAt"), "Jackson alias 'createdAt' must be serialized");
    }

    @Test
    @DisplayName("Empirical: Fail-Open Resilience: Database save failure does NOT throw HTTP 500 or break chat reply")
    void testChatControllerFailsOpenWhenDatabaseFails() {
        // Simulate database connection failure during save
        when(chatHistoryRepository.save(any(ChatHistoryEntry.class)))
                .thenThrow(new DataAccessException("Connection to PostgreSQL failed: connection refused") {});

        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดีครับ");
        req.setSessionId("sess-db-down");

        // The chat endpoint must continue operating and return response even if persistence encounters DB failure
        ResponseEntity<?> response = assertDoesNotThrow(() -> chatController.chat(req, studentAuth));
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof ChatResponse);
        ChatResponse res = (ChatResponse) response.getBody();
        assertNotNull(res.getReply());
    }

    // =========================================================================
    // 2. SESSION ISOLATION & MULTI-TENANCY
    // =========================================================================

    @Test
    @DisplayName("Empirical: Independent users are strictly isolated even when they pass each other's session ids")
    void testSessionIsolationBetweenDistinctSessions() {
        // User 1 chats (the client sessionId is ignored for logged-in users)
        ChatRequest reqA = new ChatRequest();
        reqA.setMessage("คำถามจากผู้ใช้ A");
        reqA.setSessionId("session-alpha");
        chatController.chat(reqA, studentAuth);

        // User 2 chats
        ChatRequest reqB = new ChatRequest();
        reqB.setMessage("คำถามจากผู้ใช้ B");
        reqB.setSessionId("session-beta");
        chatController.chat(reqB, otherStudentAuth);

        // User 1 asks for user 2's "session" -> still only sees their own history
        ResponseEntity<?> respA = chatController.getChatHistory("session-beta", "student:6421100099", studentAuth);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> listA = (List<ChatHistoryEntry>) respA.getBody();
        assertNotNull(listA);
        assertEquals(2, listA.size(), "User A must see exactly their own 2 entries");
        assertTrue(listA.stream().allMatch(e -> "student:6421100042".equals(e.getSessionId())));
        assertTrue(listA.stream().noneMatch(e -> e.getMessage().contains("ผู้ใช้ B")), "User A must not see User B messages");

        // User 2 retrieves their history
        ResponseEntity<?> respB = chatController.getChatHistory("session-alpha", null, otherStudentAuth);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> listB = (List<ChatHistoryEntry>) respB.getBody();
        assertNotNull(listB);
        assertEquals(2, listB.size(), "User B must see exactly their own 2 entries");
        assertTrue(listB.stream().allMatch(e -> "student:6421100099".equals(e.getSessionId())));
        assertTrue(listB.stream().noneMatch(e -> e.getMessage().contains("ผู้ใช้ A")), "User B must not see User A messages");
    }

    @Test
    @DisplayName("Empirical: Authenticated student without explicit sessionId isolates by student identity")
    void testAuthenticatedStudentWithoutSessionIdIsolatesByUserKey() {
        // Student 1 sends chat without sessionId
        ChatRequest req1 = new ChatRequest();
        req1.setMessage("คำถามของนักศึกษาคนที่หนึ่ง");
        req1.setSessionId(null);
        chatController.chat(req1, studentAuth);

        // Student 2 sends chat without sessionId
        ChatRequest req2 = new ChatRequest();
        req2.setMessage("คำถามของนักศึกษาคนที่สอง");
        req2.setSessionId(null);
        chatController.chat(req2, otherStudentAuth);

        // Student 1 retrieves history without query param
        ResponseEntity<?> resp1 = chatController.getChatHistory(null, null, studentAuth);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> list1 = (List<ChatHistoryEntry>) resp1.getBody();
        assertNotNull(list1);
        assertEquals(2, list1.size());
        assertEquals("student:6421100042", list1.get(0).getUserKey());
        assertTrue(list1.stream().noneMatch(e -> e.getMessage().contains("คนที่สอง")));

        // Student 2 retrieves history without query param
        ResponseEntity<?> resp2 = chatController.getChatHistory(null, null, otherStudentAuth);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> list2 = (List<ChatHistoryEntry>) resp2.getBody();
        assertNotNull(list2);
        assertEquals(2, list2.size());
        assertEquals("student:6421100099", list2.get(0).getUserKey());
        assertTrue(list2.stream().noneMatch(e -> e.getMessage().contains("คนที่หนึ่ง")));
    }

    @Test
    @DisplayName("Empirical: Unknown guest session returns HTTP 200 with empty array (not 404, not null, not 500)")
    void testNonExistentSessionReturnsEmptyArray() {
        ResponseEntity<?> response = chatController.getChatHistory("8d0e3c1a-0000-4000-8000-does0not0exist", null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof List);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> list = (List<ChatHistoryEntry>) response.getBody();
        assertTrue(list.isEmpty(), "Non-existent session must return empty list []");
    }

    // =========================================================================
    // 3. RETRIEVAL CHRONOLOGY & ORDERING
    // =========================================================================

    @Test
    @DisplayName("Empirical: Multi-turn chat maintains strict chronological ascending order")
    void testMultiTurnChatChronologicalOrdering() {
        String sessionId = "multi-turn-session";

        for (int i = 1; i <= 5; i++) {
            ChatRequest req = new ChatRequest();
            req.setMessage("คำถามข้อที่ " + i);
            req.setSessionId(sessionId);
            chatController.chat(req, studentAuth);
        }

        ResponseEntity<?> response = chatController.getChatHistory(sessionId, null, studentAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> list = (List<ChatHistoryEntry>) response.getBody();
        assertNotNull(list);
        assertEquals(10, list.size(), "5 exchanges must produce 10 records (5 user, 5 bot)");

        // Verify strictly alternating USER / BOT sequence
        for (int i = 0; i < list.size(); i++) {
            ChatHistoryEntry entry = list.get(i);
            if (i % 2 == 0) {
                assertEquals("USER", entry.getSender());
                assertEquals("user", entry.getRole());
            } else {
                assertEquals("BOT", entry.getSender());
                assertEquals("bot", entry.getRole());
            }
        }

        // Verify timestamps are in non-decreasing chronological order
        for (int i = 0; i < list.size() - 1; i++) {
            LocalDateTime t1 = list.get(i).getTimestamp();
            LocalDateTime t2 = list.get(i + 1).getTimestamp();
            assertTrue(t1.isBefore(t2) || t1.isEqual(t2),
                    "Timestamp at index " + i + " (" + t1 + ") must be <= index " + (i + 1) + " (" + t2 + ")");
        }
    }

    // =========================================================================
    // 4. HISTORY PURGE & CACHE RESET (DELETE /api/chat/history)
    // =========================================================================

    @Test
    @DisplayName("Empirical: DELETE /api/chat/history purges records from database and resets memory store")
    void testClearChatHistoryPurgesDatabaseAndMemory() {
        String sessionId = "session-to-clear";

        // Seed 2 chat messages (4 records in DB)
        ChatRequest req1 = new ChatRequest();
        req1.setMessage("ข้อความที่ 1");
        req1.setSessionId(sessionId);
        chatController.chat(req1, studentAuth);

        ChatRequest req2 = new ChatRequest();
        req2.setMessage("ข้อความที่ 2");
        req2.setSessionId(sessionId);
        chatController.chat(req2, studentAuth);

        assertEquals(4, inMemoryHistoryTable.size());
        assertTrue(inMemoryChatMemory.containsKey("student:6421100042"));

        // Execute clear request
        ResponseEntity<?> clearResp = chatController.clearChatHistory(sessionId, null, studentAuth);
        assertEquals(HttpStatus.OK, clearResp.getStatusCode());
        assertTrue(clearResp.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) clearResp.getBody();
        assertEquals("cleared", body.get("status"));
        assertEquals(4, body.get("deletedEntries"), "Must report 4 deleted entries");

        // Verify in-memory database is empty for this session
        assertEquals(0, inMemoryHistoryTable.size(), "All records for session must be purged");

        // Verify LangChain4j ChatMemoryStore was cleared
        assertFalse(inMemoryChatMemory.containsKey("student:6421100042"), "Chat memory for session must be purged");

        // Subsequent GET must return empty array
        ResponseEntity<?> getResp = chatController.getChatHistory(sessionId, null, studentAuth);
        List<?> remaining = (List<?>) getResp.getBody();
        assertNotNull(remaining);
        assertTrue(remaining.isEmpty(), "Subsequent GET must return empty list []");
    }

    @Test
    @DisplayName("Empirical: Clearing one session does NOT impact or purge other sessions")
    void testClearOneSessionDoesNotImpactOtherSessions() {
        // Session Keep
        ChatRequest reqKeep = new ChatRequest();
        reqKeep.setMessage("ข้อความที่จะเก็บไว้");
        reqKeep.setSessionId("session-keep");
        chatController.chat(reqKeep, studentAuth);

        // Session Delete
        ChatRequest reqDel = new ChatRequest();
        reqDel.setMessage("ข้อความที่จะลบ");
        reqDel.setSessionId("session-delete");
        chatController.chat(reqDel, otherStudentAuth);

        assertEquals(4, inMemoryHistoryTable.size());

        // Delete session-delete
        chatController.clearChatHistory("session-delete", null, otherStudentAuth);

        // Verify session-delete is empty
        ResponseEntity<?> respDel = chatController.getChatHistory("session-delete", null, otherStudentAuth);
        List<?> listDel = (List<?>) respDel.getBody();
        assertTrue(listDel.isEmpty());

        // Verify session-keep is completely intact
        ResponseEntity<?> respKeep = chatController.getChatHistory("session-keep", null, studentAuth);
        List<?> listKeep = (List<?>) respKeep.getBody();
        assertEquals(2, listKeep.size(), "Kept session must preserve all entries");
    }

    @Test
    @DisplayName("Empirical: Clearing non-existent session returns HTTP 200 with deletedEntries: 0")
    void testClearNonExistentSessionReturnsZeroDeleted() {
        ResponseEntity<?> response = chatController.clearChatHistory("ghost-session-xyz", null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(0, body.get("deletedEntries"));
        assertEquals("cleared", body.get("status"));
    }

    // =========================================================================
    // 5. CONCURRENCY & STRESS HARNESS
    // =========================================================================

    @Test
    @DisplayName("Adversarial Stress: 30 rapid sequential requests within a single session execute without corruption")
    void testRapidSequentialRequestsStress() {
        String sessionId = "rapid-sequential-sess";
        int messageCount = 30;

        for (int i = 1; i <= messageCount; i++) {
            ChatRequest req = new ChatRequest();
            req.setMessage("Rapid query #" + i);
            req.setSessionId(sessionId);
            ResponseEntity<?> res = chatController.chat(req, studentAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());
        }

        assertEquals(messageCount * 2, inMemoryHistoryTable.size(), "30 requests must produce exactly 60 entries");

        ResponseEntity<?> getResp = chatController.getChatHistory(sessionId, null, studentAuth);
        @SuppressWarnings("unchecked")
        List<ChatHistoryEntry> list = (List<ChatHistoryEntry>) getResp.getBody();
        assertNotNull(list);
        assertEquals(60, list.size());
    }

    @Test
    @DisplayName("Adversarial Stress: 25 concurrent threads submitting chat messages simultaneously to distinct sessions")
    void testConcurrentChatSubmissionsAcrossDistinctSessions() throws Exception {
        int threadCount = 25;
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        boolean finished;

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                final int index = i;
                executor.submit(() -> {
                    readyLatch.countDown();
                    try {
                        startLatch.await(); // Synchronize all 25 threads to strike at exact same microsecond
                        ChatRequest req = new ChatRequest();
                        req.setMessage("Concurrent message from thread " + index);
                        // distinct anonymous guests (each browser tab has its own random id)
                        req.setSessionId("thread-guest-session-" + index);

                        ResponseEntity<?> response = chatController.chat(req, null);
                        if (response.getStatusCode() == HttpStatus.OK) {
                            successCount.incrementAndGet();
                        } else {
                            failureCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        failureCount.incrementAndGet();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.countDown();
            finished = doneLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();
        }

        assertTrue(finished, "All 25 threads should complete within timeout");
        assertEquals(threadCount, successCount.get(), "All 25 concurrent chat requests must succeed with HTTP 200");
        assertEquals(0, failureCount.get(), "Zero exceptions or failures across concurrent threads");

        // Exactly 50 entries in database (25 user, 25 bot)
        assertEquals(threadCount * 2, inMemoryHistoryTable.size());

        // Each individual session must have exactly 2 entries and no cross-talk
        for (int i = 0; i < threadCount; i++) {
            String sess = "guest:thread-guest-session-" + i;
            long count = inMemoryHistoryTable.stream().filter(e -> sess.equals(e.getSessionId())).count();
            assertEquals(2, count, "Session " + sess + " must have exactly 2 entries (1 user, 1 bot)");
        }
    }

    @Test
    @DisplayName("Adversarial Stress: Concurrent read-while-write: 10 writers and 10 readers running in parallel")
    void testConcurrentReadWhileWriteNoDeadlocks() throws Exception {
        int writerCount = 10;
        int readerCount = 10;
        int totalThreads = writerCount + readerCount;

        CountDownLatch readyLatch = new CountDownLatch(totalThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(totalThreads);

        AtomicInteger writerSuccess = new AtomicInteger(0);
        AtomicInteger readerSuccess = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        String sharedSession = "shared-read-write-sess";

        // Seed initial history so readers have data immediately
        ChatRequest seed = new ChatRequest();
        seed.setMessage("Seed query");
        seed.setSessionId(sharedSession);
        chatController.chat(seed, studentAuth);

        boolean finished;
        try (ExecutorService executor = Executors.newFixedThreadPool(totalThreads)) {
            // 10 Writers
            for (int i = 0; i < writerCount; i++) {
                final int idx = i;
                executor.submit(() -> {
                    readyLatch.countDown();
                    try {
                        startLatch.await();
                        ChatRequest req = new ChatRequest();
                        req.setMessage("Writer message " + idx);
                        req.setSessionId(sharedSession);
                        ResponseEntity<?> res = chatController.chat(req, studentAuth);
                        if (res.getStatusCode() == HttpStatus.OK) writerSuccess.incrementAndGet();
                        else errorCount.incrementAndGet();
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            // 10 Readers
            for (int i = 0; i < readerCount; i++) {
                executor.submit(() -> {
                    readyLatch.countDown();
                    try {
                        startLatch.await();
                        ResponseEntity<?> res = chatController.getChatHistory(sharedSession, null, studentAuth);
                        if (res.getStatusCode() == HttpStatus.OK && res.getBody() instanceof List) {
                            readerSuccess.incrementAndGet();
                        } else {
                            errorCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.countDown();
            finished = doneLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();
        }

        assertTrue(finished, "Read-while-write test must complete within timeout");
        assertEquals(writerCount, writerSuccess.get(), "All writers should complete with 200 OK");
        assertEquals(readerCount, readerSuccess.get(), "All readers should complete with 200 OK");
        assertEquals(0, errorCount.get(), "Zero ConcurrentModificationExceptions or deadlocks");
    }

    @Test
    @DisplayName("Adversarial Stress: Concurrent delete-while-write does not deadlock or corrupt state")
    void testConcurrentDeleteWhileWriteSafety() throws Exception {
        int threads = 10;
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        AtomicInteger success = new AtomicInteger(0);
        AtomicInteger failures = new AtomicInteger(0);
        boolean finished;

        try (ExecutorService executor = Executors.newFixedThreadPool(threads)) {
            for (int i = 0; i < threads; i++) {
                final int idx = i;
                executor.submit(() -> {
                    readyLatch.countDown();
                    try {
                        startLatch.await();
                        String sess = "del-write-sess-" + (idx % 3); // Threads target overlapping 3 sessions
                        if (idx % 2 == 0) {
                            // Writer
                            ChatRequest req = new ChatRequest();
                            req.setMessage("Writing to " + sess);
                            req.setSessionId(sess);
                            ResponseEntity<?> res = chatController.chat(req, studentAuth);
                            if (res.getStatusCode() == HttpStatus.OK) success.incrementAndGet();
                            else failures.incrementAndGet();
                        } else {
                            // Deleter
                            ResponseEntity<?> res = chatController.clearChatHistory(sess, null, studentAuth);
                            if (res.getStatusCode() == HttpStatus.OK) success.incrementAndGet();
                            else failures.incrementAndGet();
                        }
                    } catch (Exception e) {
                        failures.incrementAndGet();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.countDown();
            finished = doneLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();
        }

        assertTrue(finished, "Delete-while-write stress test must finish within timeout");
        assertEquals(threads, success.get(), "All writers and deleters should complete with HTTP 200");
        assertEquals(0, failures.get(), "Zero deadlocks or uncaught exceptions");
    }
}
