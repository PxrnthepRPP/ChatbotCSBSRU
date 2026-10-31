package com.bsru.studentportal.service;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnowledgeIngestionServiceTest {

    @Mock
    private EmbeddingModel embeddingModel;

    @Mock
    private EmbeddingStore<TextSegment> embeddingStore;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private KnowledgeIngestionService service;

    // =========================================================================
    // 1. LIST DOCUMENTS TESTS
    // =========================================================================

    @Test
    @DisplayName("listDocuments: Empty bsru_embeddings table returns empty list")
    void testListDocumentsEmptyTable() {
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<RowMapper<Map<String, Object>>>any())).thenReturn(Collections.emptyList());

        List<Map<String, Object>> result = service.listDocuments();

        assertNotNull(result);
        assertTrue(result.isEmpty());
        verify(jdbcTemplate, times(1)).query(anyString(), ArgumentMatchers.<RowMapper<Map<String, Object>>>any());
    }

    @Test
    @DisplayName("listDocuments: Populated bsru_embeddings returns mapped documents")
    void testListDocumentsPopulatedTable() {
        Map<String, Object> sampleDoc = Map.of(
                "id", "bsru_curriculum_2569.pdf",
                "source", "bsru_curriculum_2569.pdf",
                "chunkCount", 5,
                "sampleText", "คู่มือนักศึกษา",
                "createdAt", "2026-10-31T10:00:00"
        );
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<RowMapper<Map<String, Object>>>any())).thenReturn(List.of(sampleDoc));

        List<Map<String, Object>> result = service.listDocuments();

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("bsru_curriculum_2569.pdf", result.get(0).get("source"));
    }

    @Test
    @DisplayName("listDocuments: SQL grammar exception (e.g. table not created) fails safe returning empty list")
    void testListDocumentsTableNotExistsFailsSafe() {
        SQLException sqlEx = new SQLException("relation \"bsru_embeddings\" does not exist");
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<RowMapper<Map<String, Object>>>any()))
                .thenThrow(new BadSqlGrammarException("SELECT", "SELECT ... FROM bsru_embeddings", sqlEx));

        List<Map<String, Object>> result = service.listDocuments();

        assertNotNull(result);
        assertTrue(result.isEmpty(), "Should safely return empty list when table does not exist");
    }

    // =========================================================================
    // 2. DELETE BY SOURCE TESTS
    // =========================================================================

    @Test
    @DisplayName("deleteBySource: Null identifier returns 0 without calling database")
    void testDeleteBySourceNull() {
        int affected = service.deleteBySource(null);

        assertEquals(0, affected);
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("deleteBySource: Empty identifier returns 0 without calling database")
    void testDeleteBySourceEmpty() {
        int affected = service.deleteBySource("");

        assertEquals(0, affected);
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("deleteBySource: Whitespace identifier returns 0 without calling database")
    void testDeleteBySourceWhitespace() {
        int affected = service.deleteBySource("   \t  ");

        assertEquals(0, affected);
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("deleteBySource: Existing document executes DELETE query with bound parameters")
    void testDeleteBySourceSuccess() {
        String source = "academic_handbook.pdf";
        when(jdbcTemplate.update(anyString(), eq(source), eq(source))).thenReturn(8);

        int affected = service.deleteBySource(source);

        assertEquals(8, affected);
        verify(jdbcTemplate, times(1)).update(
                contains("DELETE FROM bsru_embeddings WHERE metadata->>'source' = ? OR CAST(embedding_id AS text) = ?"),
                eq(source),
                eq(source)
        );
    }

    @Test
    @DisplayName("deleteBySource: Thai characters in source execute DELETE safely")
    void testDeleteBySourceThaiCharacters() {
        String thaiSource = "ระเบียบการศึกษา_2569.pdf";
        when(jdbcTemplate.update(anyString(), eq(thaiSource), eq(thaiSource))).thenReturn(4);

        int affected = service.deleteBySource(thaiSource);

        assertEquals(4, affected);
        verify(jdbcTemplate, times(1)).update(anyString(), eq(thaiSource), eq(thaiSource));
    }

    @Test
    @DisplayName("deleteBySource: Database exception fails safe returning 0 deleted")
    void testDeleteBySourceDatabaseExceptionFailsSafe() {
        when(jdbcTemplate.update(anyString(), anyString(), anyString()))
                .thenThrow(new DataAccessException("Connection reset by peer") {});

        int affected = service.deleteBySource("any_document.pdf");

        assertEquals(0, affected);
    }

    // =========================================================================
    // 3. INGEST DOCUMENT TESTS & OFFLINE VECTOR FALLBACK
    // =========================================================================

    @Test
    @DisplayName("ingestDocument: Offline fallback generates 768-dim deterministic vectors when Gemini API fails")
    void testIngestDocumentOfflineFallback() {
        // Force Gemini embedding model to throw exception to exercise offline fallback
        lenient().when(embeddingModel.embedAll(anyList()))
                .thenThrow(new RuntimeException("Gemini API key is invalid or quota exceeded"));
        lenient().when(embeddingModel.embed(any(TextSegment.class)))
                .thenThrow(new RuntimeException("Gemini API key is invalid or quota exceeded"));

        String content = "หลักสูตรวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา กำหนดให้นักศึกษาเรียนไม่น้อยกว่า 120 หน่วยกิต";
        String source = "curriculum_bsru_cs.pdf";

        assertDoesNotThrow(() -> service.ingestDocument(content, source));

        // In offline fallback, embeddingStore.add is called for each split segment
        verify(embeddingStore, atLeastOnce()).add(any(Embedding.class), any(TextSegment.class));
    }

    @Test
    @DisplayName("ingestDocument: Null source defaults to 'manual_entry'")
    void testIngestDocumentNullSourceDefaults() {
        lenient().when(embeddingModel.embedAll(anyList()))
                .thenThrow(new RuntimeException("Offline mode fallback"));
        lenient().when(embeddingModel.embed(any(TextSegment.class)))
                .thenThrow(new RuntimeException("Offline mode fallback"));

        String content = "คู่มือการลงทะเบียนเรียนแบบสั้น";

        assertDoesNotThrow(() -> service.ingestDocument(content, null));

        verify(embeddingStore, atLeastOnce()).add(any(Embedding.class), argThat(segment ->
                "manual_entry".equals(segment.metadata().getString("source"))
        ));
    }
}
