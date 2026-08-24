package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.KnowledgeIngestRequest;
import com.bsru.studentportal.service.KnowledgeIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/knowledge")
@RequiredArgsConstructor
@Slf4j
public class KnowledgeController {

    private final KnowledgeIngestionService knowledgeIngestionService;

    @PostMapping("/ingest")
    public ResponseEntity<?> ingestKnowledge(@RequestBody KnowledgeIngestRequest request) {
        if (request.getContent() == null || request.getContent().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content is required for knowledge ingestion"));
        }

        try {
            knowledgeIngestionService.ingestDocument(request.getContent(), request.getSource());
            return ResponseEntity.ok(Map.of(
                    "message", "Document ingested and embedded successfully",
                    "source", request.getSource() != null ? request.getSource() : "manual_entry",
                    "contentLength", request.getContent().length()
            ));
        } catch (Exception e) {
            log.error("Failed to ingest document: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to ingest document into PGVector: " + e.getMessage()
            ));
        }
    }
}
