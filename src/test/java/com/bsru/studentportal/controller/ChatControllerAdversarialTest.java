package com.bsru.studentportal.controller;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.service.GeminiDirectService;
import dev.langchain4j.data.document.Metadata;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatControllerAdversarialTest {

    @Mock
    private GeminiDirectService geminiDirectService;

    @Mock
    private StudentRecordTools studentRecordTools;

    @Mock
    private AdvisorTools advisorTools;

    @Mock
    private ChatMemoryStore chatMemoryStore;

    @Mock
    private ContentRetriever contentRetriever;

    @InjectMocks
    private ChatController chatController;

    private Authentication studentAuth;
    private Authentication advisorAuth;
    private Authentication adminAuth;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(chatController, "geminiApiKey", "demo-api-key");

        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
        );

        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_ADVISOR"))
        );

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
    }

    // =========================================================================
    // 1. INPUT VALIDATION & BOUNDARY CONDITIONS
    // =========================================================================

    @Test
    @DisplayName("Adversarial: Null message in request returns HTTP 400 Bad Request")
    void testChatNullMessageReturnsBadRequest() {
        ChatRequest req = new ChatRequest();
        req.setMessage(null);

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Message cannot be empty", body.get("error"));
        verifyNoInteractions(contentRetriever);
    }

    @Test
    @DisplayName("Adversarial: Empty string message returns HTTP 400 Bad Request")
    void testChatEmptyMessageReturnsBadRequest() {
        ChatRequest req = new ChatRequest();
        req.setMessage("");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(contentRetriever);
    }

    @Test
    @DisplayName("Adversarial: Whitespace-only message returns HTTP 400 Bad Request")
    void testChatWhitespaceOnlyMessageReturnsBadRequest() {
        ChatRequest req = new ChatRequest();
        req.setMessage("   \t\n   ");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(contentRetriever);
    }

    // =========================================================================
    // 2. VECTOR SEARCH EXCEPTION & FAILURE MODES (FAIL CLOSED)
    // =========================================================================

    @Test
    @DisplayName("Adversarial: Vector retrieval throws RuntimeException (e.g. DB connection lost) fails closed gracefully without HTTP 500")
    void testVectorRetrievalRuntimeExceptionFailsClosed() {
        when(contentRetriever.retrieve(any(Query.class)))
                .thenThrow(new RuntimeException("PostgreSQL connection refused: connection timed out"));

        ChatRequest req = new ChatRequest();
        req.setMessage("ขั้นตอนการยื่นคำร้องวิชาการ");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody() instanceof ChatResponse);
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertNotNull(chatResponse.getReply());
        assertNotNull(chatResponse.getSources(), "Sources must never be null");
        assertTrue(chatResponse.getSources().isEmpty(), "Sources must be empty on vector retrieval failure");
    }

    @Test
    @DisplayName("Adversarial: Vector retrieval throws IllegalStateException (e.g. index locked) returns HTTP 200 with fallback and empty sources")
    void testVectorRetrievalIndexLockFailsClosed() {
        when(contentRetriever.retrieve(any(Query.class)))
                .thenThrow(new IllegalStateException("pgvector index lock acquisition timeout"));

        ChatRequest req = new ChatRequest();
        req.setMessage("เกณฑ์การสำเร็จการศึกษา");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertNotNull(chatResponse.getReply());
        assertTrue(chatResponse.getSources().isEmpty());
    }

    @Test
    @DisplayName("Adversarial: Vector retrieval returns null list fails closed to empty sources")
    void testVectorRetrievalReturnsNullList() {
        when(contentRetriever.retrieve(any(Query.class))).thenReturn(null);

        ChatRequest req = new ChatRequest();
        req.setMessage("สอบถามตารางเรียน");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertNotNull(chatResponse.getSources());
        assertTrue(chatResponse.getSources().isEmpty());
    }

    @Test
    @DisplayName("Adversarial: Vector retrieval returns empty list returns empty sources")
    void testVectorRetrievalReturnsEmptyList() {
        when(contentRetriever.retrieve(any(Query.class))).thenReturn(Collections.emptyList());

        ChatRequest req = new ChatRequest();
        req.setMessage("สอบถามข้อมูลทั่วไป");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertNotNull(chatResponse.getSources());
        assertTrue(chatResponse.getSources().isEmpty());
    }

    // =========================================================================
    // 3. METADATA EDGE CASES: NULL, BLANK, DUPLICATE SOURCES
    // =========================================================================

    @Test
    @DisplayName("Adversarial: Vector retrieval returns list containing null elements handled cleanly without NPE")
    void testVectorRetrievalListWithNullElements() {
        List<Content> contentsWithNull = new ArrayList<>();
        contentsWithNull.add(null);
        contentsWithNull.add(Content.from(TextSegment.from("คู่มือนักศึกษา", Metadata.from("source", "student_handbook.pdf"))));
        contentsWithNull.add(null);

        when(contentRetriever.retrieve(any(Query.class))).thenReturn(contentsWithNull);

        ChatRequest req = new ChatRequest();
        req.setMessage("ข้อมูลคู่มือ");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals(List.of("student_handbook.pdf"), chatResponse.getSources());
    }

    @Test
    @DisplayName("Adversarial: Metadata with duplicate sources is deduplicated cleanly")
    void testVectorRetrievalDeduplicatesSources() {
        Content c1 = Content.from(TextSegment.from("Chunk 1", Metadata.from("source", "curriculum_2565.pdf")));
        Content c2 = Content.from(TextSegment.from("Chunk 2", Metadata.from("source", "curriculum_2565.pdf")));
        Content c3 = Content.from(TextSegment.from("Chunk 3", Metadata.from("source", "regulations.pdf")));
        Content c4 = Content.from(TextSegment.from("Chunk 4", Metadata.from("source", "curriculum_2565.pdf")));

        when(contentRetriever.retrieve(any(Query.class))).thenReturn(List.of(c1, c2, c3, c4));

        ChatRequest req = new ChatRequest();
        req.setMessage("หลักสูตร");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals(2, chatResponse.getSources().size());
        assertEquals(List.of("curriculum_2565.pdf", "regulations.pdf"), chatResponse.getSources());
    }

    @Test
    @DisplayName("Adversarial: Metadata with null or blank source values is ignored safely")
    void testVectorRetrievalNullAndBlankSourcesIgnored() {
        Content cNullSource = Content.from(TextSegment.from("Chunk A", new Metadata()));
        Content cBlankSource = Content.from(TextSegment.from("Chunk B", Metadata.from("source", "   ")));
        Content cEmptySource = Content.from(TextSegment.from("Chunk C", Metadata.from("source", "")));
        Content cValidSource = Content.from(TextSegment.from("Chunk D", Metadata.from("source", "valid_doc.pdf")));

        when(contentRetriever.retrieve(any(Query.class)))
                .thenReturn(List.of(cNullSource, cBlankSource, cEmptySource, cValidSource));

        ChatRequest req = new ChatRequest();
        req.setMessage("คำถามทั่วไป");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals(1, chatResponse.getSources().size());
        assertEquals("valid_doc.pdf", chatResponse.getSources().get(0));
    }

    @Test
    @DisplayName("Adversarial: Null textSegment within Content is ignored without throwing NPE")
    void testVectorRetrievalNullTextSegmentHandledSafely() {
        Content cMock = mock(Content.class);
        when(cMock.textSegment()).thenReturn(null);

        Content cValid = Content.from(TextSegment.from("เนื้อหา", Metadata.from("source", "valid.pdf")));

        when(contentRetriever.retrieve(any(Query.class))).thenReturn(List.of(cMock, cValid));

        ChatRequest req = new ChatRequest();
        req.setMessage("คำถาม");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals(List.of("valid.pdf"), chatResponse.getSources());
    }

    // =========================================================================
    // 4. RAG CONTEXT PRESERVATION & GEMINI BEHAVIOR
    // =========================================================================

    @Test
    @DisplayName("Adversarial: When Gemini API key is valid and API succeeds, sources and reply are populated")
    void testGeminiApiSuccessWithSources() throws Exception {
        ReflectionTestUtils.setField(chatController, "geminiApiKey", "AIzaSyD-valid-39-character-gemini-key");

        Content chunk = Content.from(TextSegment.from("เกณฑ์การจบการศึกษาต้องสะสมอย่างน้อย 128 หน่วยกิต", Metadata.from("source", "academic_rule_2565.pdf")));
        when(contentRetriever.retrieve(any(Query.class))).thenReturn(List.of(chunk));
        when(geminiDirectService.generateContent(anyString(), anyString())).thenReturn("ตามเกณฑ์การจบต้องมี 128 หน่วยกิตครับ");

        ChatRequest req = new ChatRequest();
        req.setMessage("เกณฑ์การจบ");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals("ตามเกณฑ์การจบต้องมี 128 หน่วยกิตครับ", chatResponse.getReply());
        assertEquals(List.of("academic_rule_2565.pdf"), chatResponse.getSources());
    }

    @Test
    @DisplayName("Adversarial: When Gemini API key is valid but API throws exception, fallback response still preserves RAG sources")
    void testGeminiApiFailureFallsBackAndPreservesSources() throws Exception {
        ReflectionTestUtils.setField(chatController, "geminiApiKey", "AIzaSyD-valid-39-character-gemini-key");

        Content chunk = Content.from(TextSegment.from("รายละเอียดคู่มือลงทะเบียน", Metadata.from("source", "registration_guide.pdf")));
        when(contentRetriever.retrieve(any(Query.class))).thenReturn(List.of(chunk));
        when(geminiDirectService.generateContent(anyString(), anyString()))
                .thenThrow(new RuntimeException("HTTP 503: Model is overloaded"));

        ChatRequest req = new ChatRequest();
        req.setMessage("คู่มือลงทะเบียน");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertNotNull(chatResponse.getReply());
        assertTrue(chatResponse.getReply().contains("registration_guide.pdf") || chatResponse.getReply().contains("คลังความรู้สาขา") || chatResponse.getReply().contains("คู่มือลงทะเบียน"));
        assertEquals(List.of("registration_guide.pdf"), chatResponse.getSources());
    }

    // =========================================================================
    // 5. SESSION RESOLUTION INTEGRITY
    // =========================================================================

    @Test
    @DisplayName("Adversarial: Anonymous chat keeps a well-formed browser guest id (stored under guest: prefix)")
    void testAnonymousChatSessionIdResolution() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดี");
        req.setSessionId("browser-client-42");

        ResponseEntity<?> response = chatController.chat(req, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals("browser-client-42", chatResponse.getSessionId());
        verify(chatMemoryStore).updateMessages(eq("guest:browser-client-42"), any());
    }

    @Test
    @DisplayName("Adversarial: Anonymous chat with null sessionId gets a fresh random id (no shared guest session)")
    void testAnonymousChatWithNullSessionIdResolution() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดี");
        req.setSessionId(null);

        ChatResponse first = (ChatResponse) chatController.chat(req, null).getBody();
        ChatResponse second = (ChatResponse) chatController.chat(req, null).getBody();

        assertNotNull(first.getSessionId());
        assertTrue(first.getSessionId().matches("[A-Za-z0-9-]{16,64}"), "server must generate a valid guest id");
        assertNotEquals(first.getSessionId(), second.getSessionId(), "guests must never share a session");
        assertNotEquals("guest-session", first.getSessionId());
    }

    @Test
    @DisplayName("Adversarial: Anonymous chat cannot pick a logged-in user's key as its session id")
    void testAnonymousChatCannotImpersonateStudentKey() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดี");
        req.setSessionId("student:6621100042");

        ChatResponse chatResponse = (ChatResponse) chatController.chat(req, null).getBody();

        assertNotEquals("student:6621100042", chatResponse.getSessionId());
        verify(chatMemoryStore, never()).updateMessages(eq("student:6621100042"), any());
        verify(chatMemoryStore, never()).updateMessages(eq("guest:student:6621100042"), any());
    }

    @Test
    @DisplayName("Adversarial: Student auth resolves to student:{studentId}")
    void testStudentAuthSessionResolution() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดีครับ");

        ResponseEntity<?> response = chatController.chat(req, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals("student:6621100042", chatResponse.getSessionId());
    }

    @Test
    @DisplayName("Adversarial: Advisor auth resolves to advisor:{advisorId}")
    void testAdvisorAuthSessionResolution() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดีครับ");

        ResponseEntity<?> response = chatController.chat(req, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals("advisor:ADV-01", chatResponse.getSessionId());
    }

    @Test
    @DisplayName("Advisor per-student risk query loads individual advisee record without bulk overview in Gemini mode and fallback mode")
    void testAdvisorPerStudentRiskQueryTargetsIndividualStudent() throws Exception {
        when(advisorTools.getAdviseeRecord("advisor:ADV-01", "6621100042"))
                .thenReturn("6621100042 นายสมชาย ใจดี | GPA สะสม: 1.85 | ระดับความเสี่ยง: สูง");

        ChatRequest req = new ChatRequest();
        req.setMessage("ช่วยวิเคราะห์ความเสี่ยงของนักศึกษา 6621100042 นายสมชาย ใจดี ว่ามีความเสี่ยงอะไรบ้าง");

        // 1. Fallback mode (demo-api-key) returns individual student risk details directly
        ResponseEntity<?> fallbackRes = chatController.chat(req, advisorAuth);
        assertEquals(HttpStatus.OK, fallbackRes.getStatusCode());
        ChatResponse fallbackBody = (ChatResponse) fallbackRes.getBody();
        assertNotNull(fallbackBody);
        assertTrue(fallbackBody.getReply().contains("6621100042"));
        assertTrue(fallbackBody.getReply().contains("GPA สะสม: 1.85"));

        // 2. Gemini mode injects only individual student record without calling getMyAdviseesRiskOverview
        ReflectionTestUtils.setField(chatController, "geminiApiKey", "AIzaSyD-valid-39-character-gemini-key");
        when(geminiDirectService.generateContent(anyString(), anyString()))
                .thenReturn("ผลการวิเคราะห์รายบุคคลของ 6621100042: เสี่ยงพ้นสภาพเนื่องจาก GPA 1.85");

        ResponseEntity<?> geminiRes = chatController.chat(req, advisorAuth);
        assertEquals(HttpStatus.OK, geminiRes.getStatusCode());
        verify(advisorTools, never()).getMyAdviseesRiskOverview(anyString());
        verify(advisorTools, times(2)).getAdviseeRecord("advisor:ADV-01", "6621100042");
    }

    @Test
    @DisplayName("Adversarial: Admin/Staff auth resolves to staff:{username}")
    void testAdminAuthSessionResolution() {
        ChatRequest req = new ChatRequest();
        req.setMessage("สวัสดีครับ");

        ResponseEntity<?> response = chatController.chat(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ChatResponse chatResponse = (ChatResponse) response.getBody();
        assertEquals("staff:admin", chatResponse.getSessionId());
    }

    // =========================================================================
    // 6. CHATRESPONSE DATA CONTRACT & SOURCES SAFETY
    // =========================================================================

    @Test
    @DisplayName("Adversarial: ChatResponse default builder guarantees sources is non-null empty list")
    void testChatResponseDefaultBuilderSourcesNonNull() {
        ChatResponse res = ChatResponse.builder()
                .reply("Hello")
                .sessionId("sess-1")
                .build();

        assertNotNull(res.getSources());
        assertTrue(res.getSources().isEmpty());
    }

    @Test
    @DisplayName("Adversarial: ChatResponse no-arg constructor guarantees sources is non-null empty list")
    void testChatResponseNoArgConstructorSourcesNonNull() {
        ChatResponse res = new ChatResponse();

        assertNotNull(res.getSources());
        assertTrue(res.getSources().isEmpty());
    }

    // =========================================================================
    // 7. OFFICIAL BSRU ACADEMIC FORMS EXPLANATION & PDF ATTACHMENT DELIVERY
    // =========================================================================

    @Test
    @DisplayName("Student asking for Transcript (ทบ.4), Leave Form, or Volunteer Form receives explanation and PDF attachment")
    void testChatReturnsOfficialFormAttachmentsAndExplanation() {
        ChatRequest r4Req = new ChatRequest();
        r4Req.setMessage("ขอใบรายงานผลการศึกษา ทบ.4 หน่อยครับ");
        ResponseEntity<?> r4Res = chatController.chat(r4Req, studentAuth);
        assertEquals(HttpStatus.OK, r4Res.getStatusCode());
        ChatResponse r4Body = (ChatResponse) r4Res.getBody();
        assertNotNull(r4Body);
        assertTrue(r4Body.getReply().contains("ทบ.4"));
        assertTrue(r4Body.getReply().contains("100 บาท"));
        assertEquals(1, r4Body.getAttachments().size());
        assertEquals("R4.pdf", r4Body.getAttachments().get(0).fileName());
        assertTrue(r4Body.getSources().isEmpty(), "RAG sources must remain untouched when attaching official forms");

        ChatRequest leaveReq = new ChatRequest();
        leaveReq.setMessage("ขอใบลาป่วยไปยื่นอาจารย์ผู้สอนครับ");
        ChatResponse leaveBody = (ChatResponse) chatController.chat(leaveReq, studentAuth).getBody();
        assertNotNull(leaveBody);
        assertTrue(leaveBody.getReply().contains("ใบรับรองแพทย์"));
        assertEquals(1, leaveBody.getAttachments().size());
        assertEquals("leave-form.pdf", leaveBody.getAttachments().get(0).fileName());

        ChatRequest volReq = new ChatRequest();
        volReq.setMessage("ขอแบบฟอร์มจิตอาสา กยศ หน่อยครับ");
        ChatResponse volBody = (ChatResponse) chatController.chat(volReq, studentAuth).getBody();
        assertNotNull(volBody);
        assertTrue(volBody.getReply().contains("กยศ."));
        assertEquals(1, volBody.getAttachments().size());
        assertEquals("volunteer-form.pdf", volBody.getAttachments().get(0).fileName());
    }

    @Test
    @DisplayName("AcademicFormController serves all 16 allowlisted PDFs and blocks unknown or traversal filenames")
    void testAcademicFormControllerServesAllowlistedPdfsAndBlocksTraversal() {
        com.bsru.studentportal.service.AcademicFormCatalogService catalog =
                new com.bsru.studentportal.service.AcademicFormCatalogService();
        AcademicFormController formController = new AcademicFormController(catalog);

        assertNotNull(formController.listForms().getBody());
        assertEquals(16, formController.listForms().getBody().size());

        for (var form : catalog.getAllForms()) {
            var res = formController.getFormPdf(form.fileName(), false);
            assertEquals(HttpStatus.OK, res.getStatusCode(), "Expected 200 OK for " + form.fileName());
            assertNotNull(res.getBody());
            assertTrue(res.getHeaders().getFirst("Content-Disposition").startsWith("inline;"));
        }

        var downloadRes = formController.getFormPdf("R17.pdf", true);
        assertEquals(HttpStatus.OK, downloadRes.getStatusCode());
        assertTrue(downloadRes.getHeaders().getFirst("Content-Disposition").startsWith("attachment;"));

        assertEquals(HttpStatus.NOT_FOUND, formController.getFormPdf("../application.properties", false).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, formController.getFormPdf("nonexistent.pdf", false).getStatusCode());
    }
}
