package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.FaqEntry;
import com.bsru.studentportal.service.FaqService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/** Admin only (SecurityConfig: /api/admin/** needs ROLE_ADMIN): frequently asked questions */
@RestController
@RequestMapping("/api/admin/faqs")
@RequiredArgsConstructor
public class FaqAdminController {

    private final FaqService faqService;

    @GetMapping
    public List<FaqEntry> list() {
        return faqService.list();
    }

    @PostMapping
    public FaqEntry create(@RequestBody FaqEntry body) {
        return faqService.create(body);
    }

    @PutMapping("/{id}")
    public FaqEntry update(@PathVariable Long id, @RequestBody FaqEntry body) {
        return faqService.update(id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        faqService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Try a question against the FAQs, as the chatbot would match it */
    @GetMapping("/test")
    public List<Map<String, Object>> test(@RequestParam String q) {
        return faqService.matches(q, 5).stream().map(m -> Map.<String, Object>of(
                "id", m.entry().getId(), "question", m.entry().getQuestion(),
                "score", Math.round(m.score() * 100) / 100.0, "answersExactly", m.answersExactly())).toList();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"faq.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(faqService.exportCsv().getBytes(StandardCharsets.UTF_8));
    }

    /** Body: {"csv": "<file text>"} */
    @PostMapping("/import")
    public FaqService.ImportResult importCsv(@RequestBody Map<String, String> body) {
        return faqService.importCsv(body.get("csv"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", String.valueOf(e.getReason())));
    }
}
