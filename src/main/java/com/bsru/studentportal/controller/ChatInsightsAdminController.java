package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.ChatLogEntry;
import com.bsru.studentportal.service.ChatLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin only (SecurityConfig: /api/admin/** needs ROLE_ADMIN): chat usage statistics,
 * satisfaction, one person's chat archive at a time, and who may see their own past chats.
 */
@RestController
@RequestMapping("/api/admin/chat-insights")
@RequiredArgsConstructor
public class ChatInsightsAdminController {

    private final ChatLogService chatLogService;

    @GetMapping("/analytics")
    public ChatLogService.Analytics analytics(@RequestParam(defaultValue = "30") int days) {
        return chatLogService.analytics(days);
    }

    @GetMapping("/people")
    public List<ChatLogService.PersonSummary> people(@RequestParam(required = false) String q) {
        return chatLogService.people(q);
    }

    /** One person's chats only, e.g. ?key=student:6421100042 */
    @GetMapping("/people/log")
    public List<ChatLogEntry> personLog(@RequestParam String key) {
        return chatLogService.personLog(key);
    }

    @GetMapping("/access")
    public ChatLogService.AccessSettings access() {
        return chatLogService.accessSettings();
    }

    /** Body: {"allowed": true} */
    @PutMapping("/access/roles/{role}")
    public ChatLogService.AccessSettings setRole(@PathVariable String role, @RequestBody Map<String, Boolean> body) {
        chatLogService.setRoleAccess(role.toUpperCase(), Boolean.TRUE.equals(body.get("allowed")));
        return chatLogService.accessSettings();
    }

    /** Body: {"personKey": "student:6421100042", "allowed": true | false | null (null = follow the role)} */
    @PutMapping("/access/people")
    public ChatLogService.AccessSettings setPerson(@RequestBody HashMap<String, Object> body) {
        Object allowed = body.get("allowed");
        chatLogService.setPersonAccess((String) body.get("personKey"), allowed instanceof Boolean b ? b : null);
        return chatLogService.accessSettings();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", String.valueOf(e.getReason())));
    }
}
