package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.NotificationListResponse;
import com.bsru.studentportal.model.Notification;
import com.bsru.studentportal.repository.NotificationRepository;
import com.bsru.studentportal.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/**
 * Challenger 1 Adversarial Empirical Verification Suite for Milestone 5 (WP-5)
 * Focus areas:
 * 1. GET /api/notifications returns 200 with { notifications: [...], unreadCount: N }
 *    matching caller's username or canonical ID (6421100042 vs "student", ADV-01 vs "advisor").
 * 2. Unauthenticated calls to GET /api/notifications return HTTP 401.
 * 3. PATCH /api/notifications/{id}/read blocks cross-user read with HTTP 403 Forbidden.
 * 4. PATCH /api/notifications/{id}/read on non-existent ID returns HTTP 404 Not Found.
 * 5. POST /api/notifications/read-all correctly marks all unread items for caller.
 * 6. Idempotence, JSON serialization contracts, null/whitespace resilience.
 */
@ExtendWith(MockitoExtension.class)
public class NotificationAdversarialChallengerTest {

    @Mock
    private NotificationRepository notificationRepository;

    private NotificationService notificationService;
    private NotificationController notificationController;
    private ObjectMapper objectMapper;

    // Test Authentications
    private Authentication studentCanonicalAuth; // "6421100042"
    private Authentication studentAliasAuth;     // "student"
    private Authentication studentOtherAuth;     // "6421100099"
    private Authentication advisorCanonicalAuth; // "ADV-01"
    private Authentication advisorAliasAuth;     // "advisor"
    private Authentication advisorOtherAuth;     // "ADV-02"
    private Authentication adminAuth;            // "admin"
    private Authentication anonAuth;             // "anonymousUser"
    private Authentication unauthenticatedAuth;  // authenticated = false

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository);
        notificationController = new NotificationController(notificationService);
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

        studentCanonicalAuth = new UsernamePasswordAuthenticationToken(
                "6421100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        studentAliasAuth = new UsernamePasswordAuthenticationToken(
                "student", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        studentOtherAuth = new UsernamePasswordAuthenticationToken(
                "6421100099", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        advisorCanonicalAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        advisorAliasAuth = new UsernamePasswordAuthenticationToken(
                "advisor", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        advisorOtherAuth = new UsernamePasswordAuthenticationToken(
                "ADV-02", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        anonAuth = new AnonymousAuthenticationToken(
                "anonKey", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        UsernamePasswordAuthenticationToken unauth = new UsernamePasswordAuthenticationToken(
                "unauthUser", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
        unauth.setAuthenticated(false);
        unauthenticatedAuth = unauth;
    }

    // =========================================================================
    // FOCUS 1: Canonical ID & Alias Resolution (6421100042 <-> student, ADV-01 <-> advisor)
    // =========================================================================

    @Test
    @DisplayName("Focus 1.1: Student alias 'student' resolves recipient keys containing 'student' and '6421100042'")
    void testAliasResolution_StudentAlias() {
        Set<String> keys = notificationService.resolveRecipientKeys(studentAliasAuth);
        assertTrue(keys.contains("student"), "Keys must contain alias 'student'");
        assertTrue(keys.contains("6421100042"), "Keys must contain canonical student ID '6421100042'");
    }

    @Test
    @DisplayName("Focus 1.2: Student canonical '6421100042' resolves recipient keys containing '6421100042' and 'student'")
    void testAliasResolution_StudentCanonical() {
        Set<String> keys = notificationService.resolveRecipientKeys(studentCanonicalAuth);
        assertTrue(keys.contains("6421100042"), "Keys must contain canonical student ID '6421100042'");
        assertTrue(keys.contains("student"), "Keys must contain alias 'student'");
    }

    @Test
    @DisplayName("Focus 1.3: Advisor alias 'advisor' resolves recipient keys containing 'advisor' and 'ADV-01'")
    void testAliasResolution_AdvisorAlias() {
        Set<String> keys = notificationService.resolveRecipientKeys(advisorAliasAuth);
        assertTrue(keys.contains("advisor"), "Keys must contain alias 'advisor'");
        assertTrue(keys.contains("ADV-01"), "Keys must contain canonical advisor ID 'ADV-01'");
    }

    @Test
    @DisplayName("Focus 1.4: Advisor canonical 'ADV-01' resolves recipient keys containing 'ADV-01' and 'advisor'")
    void testAliasResolution_AdvisorCanonical() {
        Set<String> keys = notificationService.resolveRecipientKeys(advisorCanonicalAuth);
        assertTrue(keys.contains("ADV-01"), "Keys must contain canonical advisor ID 'ADV-01'");
        assertTrue(keys.contains("advisor"), "Keys must contain alias 'advisor'");
    }

    @Test
    @DisplayName("Focus 1.5: GET /api/notifications returns 200 with notifications and unreadCount for student")
    void testGetNotifications_Student_Returns200WithPayload() {
        Notification n = Notification.builder()
                .id(1L)
                .recipientUsername("6421100042")
                .title("ผลการลงทะเบียน")
                .message("อนุมัติแล้ว")
                .type("REGISTRATION")
                .targetModule("timetable")
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();

        when(notificationRepository.findTop30ByRecipientUsernameInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(List.of(n));
        when(notificationRepository.countByRecipientUsernameInAndIsReadFalse(anyCollection()))
                .thenReturn(1L);

        ResponseEntity<?> response = notificationController.getNotifications(studentCanonicalAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof NotificationListResponse);

        NotificationListResponse payload = (NotificationListResponse) response.getBody();
        assertEquals(1, payload.getNotifications().size());
        assertEquals(1L, payload.getUnreadCount());
        assertEquals("6421100042", payload.getNotifications().get(0).getRecipientUsername());
    }

    // =========================================================================
    // FOCUS 2: Unauthenticated calls return HTTP 401
    // =========================================================================

    @Test
    @DisplayName("Focus 2.1: GET /api/notifications returns 401 when auth is null")
    void testGetNotifications_NullAuth_Returns401() {
        ResponseEntity<?> response = notificationController.getNotifications(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    @Test
    @DisplayName("Focus 2.2: GET /api/notifications returns 401 when auth is AnonymousAuthenticationToken")
    void testGetNotifications_AnonymousAuth_Returns401() {
        ResponseEntity<?> response = notificationController.getNotifications(anonAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Focus 2.3: GET /api/notifications returns 401 when auth.isAuthenticated() is false")
    void testGetNotifications_Unauthenticated_Returns401() {
        ResponseEntity<?> response = notificationController.getNotifications(unauthenticatedAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("Focus 2.4: PATCH /api/notifications/{id}/read returns 401 when unauthenticated")
    void testMarkAsRead_Unauthenticated_Returns401() {
        ResponseEntity<?> resNull = notificationController.markAsRead(1L, null);
        assertEquals(HttpStatus.UNAUTHORIZED, resNull.getStatusCode());

        ResponseEntity<?> resAnon = notificationController.markAsRead(1L, anonAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, resAnon.getStatusCode());
    }

    @Test
    @DisplayName("Focus 2.5: POST /api/notifications/read-all returns 401 when unauthenticated")
    void testMarkAllAsRead_Unauthenticated_Returns401() {
        ResponseEntity<?> resNull = notificationController.markAllAsRead(null);
        assertEquals(HttpStatus.UNAUTHORIZED, resNull.getStatusCode());

        ResponseEntity<?> resAnon = notificationController.markAllAsRead(anonAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, resAnon.getStatusCode());
    }

    // =========================================================================
    // FOCUS 3: PATCH /api/notifications/{id}/read blocks cross-user with HTTP 403
    // =========================================================================

    @Test
    @DisplayName("Focus 3.1: Student B cannot mark Student A's notification as read (HTTP 403)")
    void testMarkAsRead_CrossStudent_Returns403() {
        Notification studentANotif = Notification.builder()
                .id(201L)
                .recipientUsername("6421100042")
                .title("คำร้อง")
                .isRead(false)
                .build();

        when(notificationRepository.findById(201L)).thenReturn(Optional.of(studentANotif));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(201L, studentOtherAuth)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Focus 3.2: Advisor cannot mark Student's notification as read (HTTP 403)")
    void testMarkAsRead_AdvisorAttemptOnStudentNotif_Returns403() {
        Notification studentNotif = Notification.builder()
                .id(202L)
                .recipientUsername("6421100042")
                .title("คำร้อง")
                .isRead(false)
                .build();

        when(notificationRepository.findById(202L)).thenReturn(Optional.of(studentNotif));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(202L, advisorCanonicalAuth)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Focus 3.3: Student cannot mark Advisor's notification as read (HTTP 403)")
    void testMarkAsRead_StudentAttemptOnAdvisorNotif_Returns403() {
        Notification advisorNotif = Notification.builder()
                .id(203L)
                .recipientUsername("ADV-01")
                .title("มีคำร้องใหม่")
                .isRead(false)
                .build();

        when(notificationRepository.findById(203L)).thenReturn(Optional.of(advisorNotif));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(203L, studentCanonicalAuth)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Focus 3.4: Advisor B ('ADV-02') cannot mark Advisor A's ('ADV-01') notification as read (HTTP 403)")
    void testMarkAsRead_CrossAdvisor_Returns403() {
        Notification advisorANotif = Notification.builder()
                .id(204L)
                .recipientUsername("ADV-01")
                .title("แจ้งเตือนอาจารย์ 1")
                .isRead(false)
                .build();

        when(notificationRepository.findById(204L)).thenReturn(Optional.of(advisorANotif));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(204L, advisorOtherAuth)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(notificationRepository, never()).save(any());
    }

    // =========================================================================
    // FOCUS 4: PATCH /api/notifications/{id}/read on non-existent ID returns 404
    // =========================================================================

    @Test
    @DisplayName("Focus 4.1: PATCH on non-existent notification returns 404 Not Found")
    void testMarkAsRead_NonExistentId_Returns404() {
        when(notificationRepository.findById(999999L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(999999L, studentCanonicalAuth)
        );
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Notification not found: 999999"));
    }

    // =========================================================================
    // FOCUS 5: POST /api/notifications/read-all marks caller's unread items
    // =========================================================================

    @Test
    @DisplayName("Focus 5.1: POST /api/notifications/read-all marks caller's notifications and returns count")
    void testMarkAllAsRead_CallerMarksTheirItems() {
        when(notificationRepository.markAllAsReadByRecipientUsernames(anyCollection())).thenReturn(7);

        ResponseEntity<?> response = notificationController.markAllAsRead(studentCanonicalAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(7, body.get("markedCount"));
        assertEquals("ทำเครื่องหมายอ่านแล้วทั้งหมดเรียบร้อย", body.get("message"));
    }

    @Test
    @DisplayName("Focus 5.2: POST /api/notifications/read-all with 0 unread returns count 0 gracefully")
    void testMarkAllAsRead_ZeroUnread_ReturnsZeroCount() {
        when(notificationRepository.markAllAsReadByRecipientUsernames(anyCollection())).thenReturn(0);

        ResponseEntity<?> response = notificationController.markAllAsRead(advisorAliasAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(0, body.get("markedCount"));
    }

    // =========================================================================
    // FOCUS 6: Edge Cases, Idempotence & Serialization Integrity
    // =========================================================================

    @Test
    @DisplayName("Focus 6.1: Mark as read is idempotent — marking already read item does not call save again")
    void testMarkAsRead_Idempotent_DoesNotSaveTwice() {
        Notification alreadyRead = Notification.builder()
                .id(301L)
                .recipientUsername("6421100042")
                .isRead(true)
                .build();

        when(notificationRepository.findById(301L)).thenReturn(Optional.of(alreadyRead));

        ResponseEntity<?> response = notificationController.markAsRead(301L, studentCanonicalAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Notification result = (Notification) response.getBody();
        assertNotNull(result);
        assertTrue(result.isRead());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Focus 6.2: Admin can mark any notification as read")
    void testMarkAsRead_AdminBypassesOwnership() {
        Notification anyNotif = Notification.builder()
                .id(302L)
                .recipientUsername("6421100099")
                .isRead(false)
                .build();

        when(notificationRepository.findById(302L)).thenReturn(Optional.of(anyNotif));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

        ResponseEntity<?> response = notificationController.markAsRead(302L, adminAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Notification result = (Notification) response.getBody();
        assertTrue(result.isRead());
        verify(notificationRepository, times(1)).save(anyNotif);
    }

    @Test
    @DisplayName("Focus 6.3: notifyUser with null or blank recipient gracefully returns null without crashing")
    void testNotifyUser_BlankRecipient_ReturnsNull() {
        assertNull(notificationService.notifyUser(null, "Title", "Msg", "module"));
        assertNull(notificationService.notifyUser("   ", "Title", "Msg", "module"));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Focus 6.4: JSON serialization outputs recipientId, recipientUsername, isRead, and targetModule")
    void testNotification_JsonSerialization() throws Exception {
        Notification notif = Notification.builder()
                .id(999L)
                .recipientUsername("6421100042")
                .title("หัวข้อ")
                .message("ข้อความ")
                .type("SYSTEM")
                .targetModule("petitions")
                .isRead(true)
                .createdAt(LocalDateTime.of(2026, 10, 31, 12, 0))
                .build();

        String json = objectMapper.writeValueAsString(notif);
        assertTrue(json.contains("\"recipientUsername\":\"6421100042\""), "JSON must contain recipientUsername");
        assertTrue(json.contains("\"recipientId\":\"6421100042\""), "JSON must contain recipientId alias");
        assertTrue(json.contains("\"isRead\":true"), "JSON must contain isRead boolean");
        assertTrue(json.contains("\"targetModule\":\"petitions\""), "JSON must contain targetModule");
    }
}
