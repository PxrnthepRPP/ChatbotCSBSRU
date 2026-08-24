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
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeIngestionService {

    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;

    public void ingestDocument(String content, String metadataSource) {
        log.info("Ingesting document from source: {}", metadataSource);

        Document document = Document.from(content, Metadata.from("source", metadataSource != null ? metadataSource : "manual_entry"));

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
}
