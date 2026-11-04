package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.KnowledgeIngestRequest;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.KnowledgeIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/knowledge")
@RequiredArgsConstructor
@Slf4j
public class KnowledgeController {

    private final KnowledgeIngestionService knowledgeIngestionService;

    @GetMapping
    public ResponseEntity<?> listKnowledge(Authentication authentication) {
        if (!CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการคลังความรู้ได้"));
        }

        List<Map<String, Object>> documents = knowledgeIngestionService.listDocuments();
        return ResponseEntity.ok(documents);
    }

    @PostMapping("/ingest")
    public ResponseEntity<?> ingestKnowledge(
            @RequestBody KnowledgeIngestRequest request,
            Authentication authentication
    ) {
        if (!CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการคลังความรู้ได้"));
        }

        if (request.getContent() == null || request.getContent().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content is required for knowledge ingestion"));
        }

        String source = request.getSource() != null ? request.getSource() : "manual_entry";
        if (Boolean.TRUE.equals(request.getReplaceExisting())) {
            knowledgeIngestionService.deleteBySource(source);
        }

        try {
            knowledgeIngestionService.ingestDocument(request.getContent(), source);
            return ResponseEntity.ok(Map.of(
                    "message", "Document ingested and embedded successfully",
                    "source", source,
                    "contentLength", request.getContent().length()
            ));
        } catch (Exception e) {
            log.error("Failed to ingest document: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to ingest document into PGVector: " + e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<?> deleteKnowledgeByPath(
            @PathVariable String documentId,
            Authentication authentication
    ) {
        return deleteKnowledgeInternal(documentId, authentication);
    }

    @DeleteMapping
    public ResponseEntity<?> deleteKnowledgeByParam(
            @RequestParam(required = false) String source,
            Authentication authentication
    ) {
        if (source == null || source.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Source parameter is required"));
        }
        return deleteKnowledgeInternal(source, authentication);
    }

    private ResponseEntity<?> deleteKnowledgeInternal(String identifier, Authentication authentication) {
        if (!CurrentUser.isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการคลังความรู้ได้"));
        }

        int deletedCount = knowledgeIngestionService.deleteBySource(identifier);
        if (deletedCount == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Document not found in knowledge base", "source", identifier));
        }

        return ResponseEntity.ok(Map.of(
                "message", "Document deleted successfully",
                "source", identifier,
                "deletedChunks", deletedCount
        ));
    }
}
