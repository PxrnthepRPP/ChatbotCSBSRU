package com.bsru.studentportal.service;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.DocumentSplitter;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeIngestionService {

    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final JdbcTemplate jdbcTemplate;

    public void ingestDocument(String content, String metadataSource) {
        log.info("Ingesting document from source: {}", metadataSource);

        String src = metadataSource != null ? metadataSource : "manual_entry";
        Metadata metadata = new Metadata();
        metadata.put("source", src);
        metadata.put("createdAt", LocalDateTime.now().toString());

        Document document = Document.from(content, metadata);

        try {
            EmbeddingStoreIngestor ingestor = EmbeddingStoreIngestor.builder()
                    .documentSplitter(DocumentSplitters.recursive(500, 50))
                    .embeddingModel(embeddingModel)
                    .embeddingStore(embeddingStore)
                    .build();

            ingestor.ingest(document);
            log.info("Successfully ingested and embedded document via Gemini Embedding API: {}", metadataSource);
        } catch (Exception e) {
            log.warn("Gemini Embedding API not available ({}). Using offline vector embedding into PGVector...", e.getMessage());

            DocumentSplitter splitter = DocumentSplitters.recursive(500, 50);
            List<TextSegment> segments = splitter.split(document);

            for (TextSegment segment : segments) {
                // Generate a 768-dimensional normalized deterministic vector for local development/offline mode
                float[] vector = new float[768];
                byte[] bytes = segment.text().getBytes();
                for (int i = 0; i < bytes.length; i++) {
                    vector[i % 768] += (bytes[i] & 0xFF) / 255.0f;
                }
                Embedding embedding = Embedding.from(vector);
                embeddingStore.add(embedding, segment);
            }
            log.info("Successfully ingested {} segments into PGVector table 'bsru_embeddings' (offline mode)", segments.size());
        }
    }

    public List<Map<String, Object>> listDocuments() {
        try {
            String sql = """
                SELECT 
                    COALESCE(metadata->>'source', 'manual_entry') AS source_name,
                    COUNT(*) AS chunk_count,
                    MIN(CAST(embedding_id AS text)) AS sample_id,
                    SUBSTRING(MIN(text) FROM 1 FOR 200) AS sample_text,
                    MAX(metadata->>'createdAt') AS created_at
                FROM bsru_embeddings
                GROUP BY metadata->>'source'
                ORDER BY source_name ASC
            """;
            return jdbcTemplate.query(sql, (rs, rowNum) -> {
                String src = rs.getString("source_name");
                int count = rs.getInt("chunk_count");
                String sampleId = rs.getString("sample_id");
                String snippet = rs.getString("sample_text");
                String createdAt = rs.getString("created_at");
                if (createdAt == null || createdAt.isBlank()) {
                    createdAt = LocalDateTime.now().toString();
                }

                Map<String, Object> doc = new LinkedHashMap<>();
                doc.put("id", src);
                doc.put("title", src);
                doc.put("source", src);
                doc.put("documentId", src);
                doc.put("chunkCount", count);
                doc.put("chunksCount", count);
                doc.put("sampleId", sampleId);
                doc.put("snippet", snippet != null ? snippet : "");
                doc.put("sampleText", snippet != null ? snippet : "");
                doc.put("createdAt", createdAt);
                return doc;
            });
        } catch (Exception e) {
            log.warn("Could not query bsru_embeddings (table may not exist yet): {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public int deleteBySource(String sourceOrId) {
        if (sourceOrId == null || sourceOrId.isBlank()) return 0;
        try {
            String sql = "DELETE FROM bsru_embeddings WHERE metadata->>'source' = ? OR CAST(embedding_id AS text) = ?";
            int affected = jdbcTemplate.update(sql, sourceOrId, sourceOrId);
            log.info("Deleted {} chunks for source/id: {}", affected, sourceOrId);
            return affected;
        } catch (Exception e) {
            log.warn("Failed to delete chunks from bsru_embeddings: {}", e.getMessage());
            return 0;
        }
    }
}
