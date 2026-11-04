package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.KnowledgeIngestRequest;
import com.bsru.studentportal.service.KnowledgeIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnowledgeControllerAdversarialTest {

    @Mock
    private KnowledgeIngestionService knowledgeIngestionService;

    @InjectMocks
    private KnowledgeController knowledgeController;

    private Authentication studentAuth;
    private Authentication advisorAuth;
    private Authentication adminAuth;

    @BeforeEach
    void setUp() {
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
    // 1. RBAC BOUNDARY TESTS: NON-ADMIN ACCESS REJECTION (403 FORBIDDEN)
    // =========================================================================

    @Test
    @DisplayName("RBAC: Student caller is forbidden from listing knowledge base documents")
    void testStudentCannotListKnowledge() {
        ResponseEntity<?> response = knowledgeController.listKnowledge(studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Advisor caller is forbidden from listing knowledge base documents")
    void testAdvisorCannotListKnowledge() {
        ResponseEntity<?> response = knowledgeController.listKnowledge(advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Anonymous/Unauthenticated caller is forbidden from listing knowledge documents")
    void testAnonymousCannotListKnowledge() {
        ResponseEntity<?> response = knowledgeController.listKnowledge(null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Student caller is forbidden from ingesting knowledge documents")
    void testStudentCannotIngestKnowledge() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("Test curriculum text", "curriculum.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Advisor caller is forbidden from ingesting knowledge documents")
    void testAdvisorCannotIngestKnowledge() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("Test curriculum text", "curriculum.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Anonymous/Unauthenticated caller is forbidden from ingesting knowledge documents")
    void testAnonymousCannotIngestKnowledge() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("Test curriculum text", "curriculum.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Student caller is forbidden from deleting knowledge document by path parameter")
    void testStudentCannotDeleteByPath() {
        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByPath("doc_123.pdf", studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Student caller is forbidden from deleting knowledge document by query parameter")
    void testStudentCannotDeleteByParam() {
        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByParam("doc_123.pdf", studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Advisor caller is forbidden from deleting knowledge document")
    void testAdvisorCannotDeleteKnowledge() {
        ResponseEntity<?> responsePath = knowledgeController.deleteKnowledgeByPath("doc_123.pdf", advisorAuth);
        ResponseEntity<?> responseParam = knowledgeController.deleteKnowledgeByParam("doc_123.pdf", advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, responsePath.getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, responseParam.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("RBAC: Anonymous/Unauthenticated caller is forbidden from deleting knowledge document")
    void testAnonymousCannotDeleteKnowledge() {
        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByPath("doc_123.pdf", null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    // =========================================================================
    // 2. KNOWLEDGE BASE LISTING (EMPTY VS POPULATED)
    // =========================================================================

    @Test
    @DisplayName("Listing: Empty bsru_embeddings returns HTTP 200 OK with empty array")
    void testListKnowledgeEmptyDatabase() {
        when(knowledgeIngestionService.listDocuments()).thenReturn(Collections.emptyList());

        ResponseEntity<?> response = knowledgeController.listKnowledge(adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof List);
        List<?> list = (List<?>) response.getBody();
        assertTrue(list.isEmpty());
        verify(knowledgeIngestionService, times(1)).listDocuments();
    }

    @Test
    @DisplayName("Listing: Populated bsru_embeddings returns HTTP 200 OK with document list")
    void testListKnowledgePopulatedDatabase() {
        Map<String, Object> doc1 = new LinkedHashMap<>();
        doc1.put("id", "bsru_handbook_2026.pdf");
        doc1.put("source", "bsru_handbook_2026.pdf");
        doc1.put("chunkCount", 14);
        doc1.put("sampleText", "คู่มือนักศึกษา พ.ศ. 2569...");
        doc1.put("createdAt", "2026-10-31T10:00:00");

        Map<String, Object> doc2 = new LinkedHashMap<>();
        doc2.put("id", "curriculum_cs_2569.pdf");
        doc2.put("source", "curriculum_cs_2569.pdf");
        doc2.put("chunkCount", 8);
        doc2.put("sampleText", "หลักสูตรวิทยาการคอมพิวเตอร์...");
        doc2.put("createdAt", "2026-10-31T10:30:00");

        when(knowledgeIngestionService.listDocuments()).thenReturn(List.of(doc1, doc2));

        ResponseEntity<?> response = knowledgeController.listKnowledge(adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof List);
        List<?> list = (List<?>) response.getBody();
        assertEquals(2, list.size());
        assertEquals("bsru_handbook_2026.pdf", ((Map<?, ?>) list.get(0)).get("source"));
        assertEquals(14, ((Map<?, ?>) list.get(0)).get("chunkCount"));
    }

    // =========================================================================
    // 3. INGESTION INPUT VALIDATION & BOUNDARY CONDITIONS
    // =========================================================================

    @Test
    @DisplayName("Validation: Null content returns HTTP 400 Bad Request")
    void testIngestNullContentReturnsBadRequest() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(null, "doc.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.get("error").toString().contains("Content is required"));
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("Validation: Empty string content returns HTTP 400 Bad Request")
    void testIngestEmptyContentReturnsBadRequest() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("", "doc.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("Validation: Whitespace-only content returns HTTP 400 Bad Request")
    void testIngestWhitespaceContentReturnsBadRequest() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("   \t\n   ", "doc.pdf", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("Defaulting: Null source defaults to 'manual_entry'")
    void testIngestNullSourceDefaultsToManualEntry() {
        KnowledgeIngestRequest req = new KnowledgeIngestRequest("Sample syllabus content", null, false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("manual_entry", body.get("source"));
        verify(knowledgeIngestionService, times(1)).ingestDocument("Sample syllabus content", "manual_entry");
        verify(knowledgeIngestionService, never()).deleteBySource(anyString());
    }

    // =========================================================================
    // 4. INGESTION WITH replaceExisting=true (ORDER OF EXECUTION)
    // =========================================================================

    @Test
    @DisplayName("replaceExisting=true: Deletes existing chunks before inserting new document")
    void testIngestReplaceExistingTrueDeletesFirst() {
        String source = "academic_regulations_2026.pdf";
        String content = "Updated academic regulations with revised credit requirements.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, source, true);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());

        InOrder inOrder = inOrder(knowledgeIngestionService);
        inOrder.verify(knowledgeIngestionService).deleteBySource(source);
        inOrder.verify(knowledgeIngestionService).ingestDocument(content, source);
    }

    @Test
    @DisplayName("replaceExisting=false: Does not invoke deleteBySource")
    void testIngestReplaceExistingFalseDoesNotDelete() {
        String source = "append_only_notes.txt";
        String content = "Additional notes to be appended into vector store.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, source, false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(knowledgeIngestionService, never()).deleteBySource(anyString());
        verify(knowledgeIngestionService, times(1)).ingestDocument(content, source);
    }

    @Test
    @DisplayName("replaceExisting=null: Defaults to not invoking deleteBySource")
    void testIngestReplaceExistingNullDoesNotDelete() {
        String source = "guidelines.pdf";
        String content = "Standard general guidelines for enrolled students.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, source, null);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(knowledgeIngestionService, never()).deleteBySource(anyString());
        verify(knowledgeIngestionService, times(1)).ingestDocument(content, source);
    }

    @Test
    @DisplayName("replaceExisting=true with null source: Deletes 'manual_entry' before inserting")
    void testIngestReplaceExistingTrueWithNullSource() {
        String content = "Directly pasted guidelines text.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, null, true);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        InOrder inOrder = inOrder(knowledgeIngestionService);
        inOrder.verify(knowledgeIngestionService).deleteBySource("manual_entry");
        inOrder.verify(knowledgeIngestionService).ingestDocument(content, "manual_entry");
    }

    // =========================================================================
    // 5. DOCUMENT DELETION: PATH VS PARAM & FOUND VS NOT FOUND
    // =========================================================================

    @Test
    @DisplayName("Delete by path: Existing document returns HTTP 200 OK with deletedChunks")
    void testDeleteByPathExistingDocument() {
        when(knowledgeIngestionService.deleteBySource("bsru_curriculum.pdf")).thenReturn(12);

        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByPath("bsru_curriculum.pdf", adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Document deleted successfully", body.get("message"));
        assertEquals("bsru_curriculum.pdf", body.get("source"));
        assertEquals(12, body.get("deletedChunks"));
    }

    @Test
    @DisplayName("Delete by path: Non-existent document returns HTTP 404 Not Found")
    void testDeleteByPathNonExistentDocument() {
        when(knowledgeIngestionService.deleteBySource("non_existent_doc.pdf")).thenReturn(0);

        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByPath("non_existent_doc.pdf", adminAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.get("error").toString().contains("Document not found"));
        assertEquals("non_existent_doc.pdf", body.get("source"));
    }

    @Test
    @DisplayName("Delete by query param: Existing document returns HTTP 200 OK with deletedChunks")
    void testDeleteByParamExistingDocument() {
        when(knowledgeIngestionService.deleteBySource("guidelines.pdf")).thenReturn(5);

        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByParam("guidelines.pdf", adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Document deleted successfully", body.get("message"));
        assertEquals("guidelines.pdf", body.get("source"));
        assertEquals(5, body.get("deletedChunks"));
    }

    @Test
    @DisplayName("Delete by query param: Non-existent document returns HTTP 404 Not Found")
    void testDeleteByParamNonExistentDocument() {
        when(knowledgeIngestionService.deleteBySource("ghost_file.pdf")).thenReturn(0);

        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByParam("ghost_file.pdf", adminAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.get("error").toString().contains("Document not found"));
    }

    @Test
    @DisplayName("Delete by query param: Null source parameter returns HTTP 400 Bad Request")
    void testDeleteByParamNullSourceReturnsBadRequest() {
        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByParam(null, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.get("error").toString().contains("Source parameter is required"));
        verifyNoInteractions(knowledgeIngestionService);
    }

    @Test
    @DisplayName("Delete by query param: Blank source parameter returns HTTP 400 Bad Request")
    void testDeleteByParamBlankSourceReturnsBadRequest() {
        ResponseEntity<?> response = knowledgeController.deleteKnowledgeByParam("   ", adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(knowledgeIngestionService);
    }

    // =========================================================================
    // 6. SPECIAL CHARACTERS, SPACES, THAI CHARACTERS & ADVERSARIAL PAYLOADS
    // =========================================================================

    @Test
    @DisplayName("Adversarial: Thai characters in document source name are correctly handled")
    void testThaiCharactersInSourceName() {
        String thaiSource = "ข้อบังคับมหาวิทยาลัย_พศ_2569.pdf";
        String content = "ข้อบังคับว่าด้วยการจัดการศึกษาระดับปริญญาตรี";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, thaiSource, true);

        when(knowledgeIngestionService.deleteBySource(thaiSource)).thenReturn(3);

        ResponseEntity<?> ingestRes = knowledgeController.ingestKnowledge(req, adminAuth);
        assertEquals(HttpStatus.OK, ingestRes.getStatusCode());
        Map<?, ?> ingestBody = (Map<?, ?>) ingestRes.getBody();
        assertEquals(thaiSource, ingestBody.get("source"));

        // Test deletion of Thai source
        ResponseEntity<?> deleteRes = knowledgeController.deleteKnowledgeByParam(thaiSource, adminAuth);
        assertEquals(HttpStatus.OK, deleteRes.getStatusCode());
        Map<?, ?> deleteBody = (Map<?, ?>) deleteRes.getBody();
        assertEquals(thaiSource, deleteBody.get("source"));
    }

    @Test
    @DisplayName("Adversarial: Source names with spaces and symbols are preserved without truncation")
    void testSourceWithSpacesAndSymbols() {
        String complexSource = "BSRU Curriculum [2026] & Guidelines (Revised #1).pdf";
        String content = "Complex named document content detailing course structure.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, complexSource, true);

        when(knowledgeIngestionService.deleteBySource(complexSource)).thenReturn(7);

        ResponseEntity<?> ingestRes = knowledgeController.ingestKnowledge(req, adminAuth);
        assertEquals(HttpStatus.OK, ingestRes.getStatusCode());
        assertEquals(complexSource, ((Map<?, ?>) ingestRes.getBody()).get("source"));

        ResponseEntity<?> deleteRes = knowledgeController.deleteKnowledgeByParam(complexSource, adminAuth);
        assertEquals(HttpStatus.OK, deleteRes.getStatusCode());
        assertEquals(complexSource, ((Map<?, ?>) deleteRes.getBody()).get("source"));
    }

    @Test
    @DisplayName("Adversarial: SQL injection strings in source name are safely treated as literal text")
    void testSqlInjectionInSourceNameHandledSafely() {
        String sqlInjectionSource = "test'; DROP TABLE bsru_embeddings; --";
        String content = "Safe content payload.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, sqlInjectionSource, true);

        when(knowledgeIngestionService.deleteBySource(sqlInjectionSource)).thenReturn(1);

        ResponseEntity<?> ingestRes = knowledgeController.ingestKnowledge(req, adminAuth);
        assertEquals(HttpStatus.OK, ingestRes.getStatusCode());
        assertEquals(sqlInjectionSource, ((Map<?, ?>) ingestRes.getBody()).get("source"));

        ResponseEntity<?> deleteRes = knowledgeController.deleteKnowledgeByParam(sqlInjectionSource, adminAuth);
        assertEquals(HttpStatus.OK, deleteRes.getStatusCode());
        assertEquals(sqlInjectionSource, ((Map<?, ?>) deleteRes.getBody()).get("source"));
    }

    @Test
    @DisplayName("Adversarial: Unicode emojis and multilingual characters in source name")
    void testUnicodeAndEmojisInSourceName() {
        String unicodeSource = "📚_หลักสูตร_CS_2026_🎓_日本語.pdf";
        String content = "Multilingual guidelines.";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, unicodeSource, false);

        ResponseEntity<?> ingestRes = knowledgeController.ingestKnowledge(req, adminAuth);
        assertEquals(HttpStatus.OK, ingestRes.getStatusCode());
        assertEquals(unicodeSource, ((Map<?, ?>) ingestRes.getBody()).get("source"));
        verify(knowledgeIngestionService).ingestDocument(content, unicodeSource);
    }

    @Test
    @DisplayName("Adversarial: Extremely large content payload (100k+ chars) processes properly")
    void testExtremelyLargeContentPayload() {
        String largeContent = "ข้อความระเบียบปฏิบัติเพื่อทดสอบประสิทธิภาพการแบ่งส่วนข้อมูล ".repeat(2000);
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(largeContent, "large_doc.txt", false);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(largeContent.length(), body.get("contentLength"));
        verify(knowledgeIngestionService).ingestDocument(largeContent, "large_doc.txt");
    }

    // =========================================================================
    // 7. EXCEPTION & FAILURE MODES (FAIL CLOSED)
    // =========================================================================

    @Test
    @DisplayName("Failure Mode: Service exception during ingestion returns HTTP 500 with error details")
    void testIngestServiceExceptionReturns500() {
        String content = "Important handbook content";
        String source = "failing_doc.pdf";
        KnowledgeIngestRequest req = new KnowledgeIngestRequest(content, source, false);

        doThrow(new RuntimeException("PGVector database connection timeout"))
                .when(knowledgeIngestionService).ingestDocument(content, source);

        ResponseEntity<?> response = knowledgeController.ingestKnowledge(req, adminAuth);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertTrue(body.get("error").toString().contains("Failed to ingest document into PGVector"));
        assertTrue(body.get("error").toString().contains("PGVector database connection timeout"));
    }
}
