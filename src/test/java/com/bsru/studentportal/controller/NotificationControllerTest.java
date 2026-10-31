package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.NotificationListResponse;
import com.bsru.studentportal.model.Notification;
import com.bsru.studentportal.repository.NotificationRepository;
import com.bsru.studentportal.service.NotificationService;
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

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationRepository notificationRepository;

    private NotificationService notificationService;
    private NotificationController notificationController;

    private Authentication studentAuth;
    private Authentication studentAliasAuth;
    private Authentication otherStudentAuth;
    private Authentication advisorAuth;
    private Authentication advisorAliasAuth;
    private Authentication adminAuth;
    private Authentication anonAuth;

    private Notification notifStudent;
    private Notification notifAdvisor;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository);
        notificationController = new NotificationController(notificationService);

        studentAuth = new UsernamePasswordAuthenticationToken(
                "6421100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        studentAliasAuth = new UsernamePasswordAuthenticationToken(
                "student", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        otherStudentAuth = new UsernamePasswordAuthenticationToken(
                "6421100099", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        advisorAliasAuth = new UsernamePasswordAuthenticationToken(
                "advisor", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        anonAuth = new AnonymousAuthenticationToken(
                "anonKey", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        notifStudent = Notification.builder()
                .id(101L)
                .recipientUsername("6421100042")
                .title("คำร้องได้รับการอนุมัติแล้ว")
                .message("คำร้องของคุณได้รับการอนุมัติเรียบร้อยแล้ว")
                .type("PETITION")
                .targetModule("petitions")
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();

        notifAdvisor = Notification.builder()
                .id(102L)
                .recipientUsername("ADV-01")
                .title("มีคำร้องใหม่รอการพิจารณา")
                .message("นักศึกษา 6421100042 ยื่นคำร้องใหม่")
                .type("PETITION")
                .targetModule("advisor-petitions")
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET /api/notifications: Student retrieves notifications and unreadCount")
    void testListNotifications_Student_Success() {
        when(notificationRepository.findTop30ByRecipientUsernameInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(List.of(notifStudent));
        when(notificationRepository.countByRecipientUsernameInAndIsReadFalse(anyCollection()))
                .thenReturn(1L);

        ResponseEntity<?> res = notificationController.getNotifications(studentAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertTrue(res.getBody() instanceof NotificationListResponse);

        NotificationListResponse listRes = (NotificationListResponse) res.getBody();
        assertEquals(1, listRes.getNotifications().size());
        assertEquals(1L, listRes.getUnreadCount());
        assertEquals("6421100042", listRes.getNotifications().get(0).getRecipientUsername());
    }

    @Test
    @DisplayName("GET /api/notifications: Advisor retrieves notifications")
    void testListNotifications_Advisor_Success() {
        when(notificationRepository.findTop30ByRecipientUsernameInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(List.of(notifAdvisor));
        when(notificationRepository.countByRecipientUsernameInAndIsReadFalse(anyCollection()))
                .thenReturn(1L);

        ResponseEntity<?> res = notificationController.getNotifications(advisorAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        NotificationListResponse listRes = (NotificationListResponse) res.getBody();
        assertNotNull(listRes);
        assertEquals(1, listRes.getNotifications().size());
        assertEquals("ADV-01", listRes.getNotifications().get(0).getRecipientUsername());
    }

    @Test
    @DisplayName("GET /api/notifications: Empty list returns unreadCount 0")
    void testListNotifications_Empty_ReturnsZeroCount() {
        when(notificationRepository.findTop30ByRecipientUsernameInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(Collections.emptyList());
        when(notificationRepository.countByRecipientUsernameInAndIsReadFalse(anyCollection()))
                .thenReturn(0L);

        ResponseEntity<?> res = notificationController.getNotifications(studentAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        NotificationListResponse listRes = (NotificationListResponse) res.getBody();
        assertNotNull(listRes);
        assertEquals(0, listRes.getNotifications().size());
        assertEquals(0L, listRes.getUnreadCount());
    }

    @Test
    @DisplayName("GET /api/notifications: Unauthenticated caller returns 401")
    void testListNotifications_Unauthenticated_Returns401() {
        ResponseEntity<?> resNull = notificationController.getNotifications(null);
        assertEquals(HttpStatus.UNAUTHORIZED, resNull.getStatusCode());

        ResponseEntity<?> resAnon = notificationController.getNotifications(anonAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, resAnon.getStatusCode());
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Owner student marks as read")
    void testMarkAsRead_RecipientStudent_Success() {
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(notifStudent));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

        ResponseEntity<?> res = notificationController.markAsRead(101L, studentAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Notification updated = (Notification) res.getBody();
        assertNotNull(updated);
        assertTrue(updated.isRead());
        verify(notificationRepository, times(1)).save(notifStudent);
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Student alias ('student') marks as read for '6421100042'")
    void testMarkAsRead_StudentAlias_Success() {
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(notifStudent));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

        ResponseEntity<?> res = notificationController.markAsRead(101L, studentAliasAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Notification updated = (Notification) res.getBody();
        assertNotNull(updated);
        assertTrue(updated.isRead());
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Admin can mark any notification as read")
    void testMarkAsRead_Admin_Success() {
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(notifStudent));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

        ResponseEntity<?> res = notificationController.markAsRead(101L, adminAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Notification updated = (Notification) res.getBody();
        assertNotNull(updated);
        assertTrue(updated.isRead());
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Cross-student access throws 403 Forbidden")
    void testMarkAsRead_DifferentStudent_Returns403() {
        when(notificationRepository.findById(101L)).thenReturn(Optional.of(notifStudent));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(101L, otherStudentAuth)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Non-existent notification throws 404 Not Found")
    void testMarkAsRead_NotFound_Returns404() {
        when(notificationRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationController.markAsRead(999L, studentAuth)
        );
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    @DisplayName("PATCH /api/notifications/{id}/read: Unauthenticated caller returns 401")
    void testMarkAsRead_Unauthenticated_Returns401() {
        ResponseEntity<?> resNull = notificationController.markAsRead(101L, null);
        assertEquals(HttpStatus.UNAUTHORIZED, resNull.getStatusCode());

        ResponseEntity<?> resAnon = notificationController.markAsRead(101L, anonAuth);
        assertEquals(HttpStatus.UNAUTHORIZED, resAnon.getStatusCode());
    }

    @Test
    @DisplayName("POST /api/notifications/read-all: Marks all caller notifications as read")
    void testMarkAllAsRead_Authenticated_Success() {
        when(notificationRepository.markAllAsReadByRecipientUsernames(anyCollection())).thenReturn(3);

        ResponseEntity<?> res = notificationController.markAllAsRead(studentAuth);
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(3, body.get("markedCount"));
    }

    @Test
    @DisplayName("POST /api/notifications/read-all: Unauthenticated caller returns 401")
    void testMarkAllAsRead_Unauthenticated_Returns401() {
        ResponseEntity<?> res = notificationController.markAllAsRead(null);
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
    }

    @Test
    @DisplayName("Service: resolveRecipientKeys maps both aliases and canonical IDs")
    void testResolveRecipientKeys() {
        Set<String> studentKeys = notificationService.resolveRecipientKeys(studentAliasAuth);
        assertTrue(studentKeys.contains("student"));
        assertTrue(studentKeys.contains("6421100042"));

        Set<String> advisorKeys = notificationService.resolveRecipientKeys(advisorAliasAuth);
        assertTrue(advisorKeys.contains("advisor"));
        assertTrue(advisorKeys.contains("ADV-01"));

        Set<String> adminKeys = notificationService.resolveRecipientKeys(adminAuth);
        assertTrue(adminKeys.contains("admin"));

        Set<String> unauthKeys = notificationService.resolveRecipientKeys(anonAuth);
        assertTrue(unauthKeys.isEmpty());
    }

    @Test
    @DisplayName("Service: notifyUser creates and saves notification")
    void testNotifyUser() {
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            n.setId(555L);
            return n;
        });

        Notification saved = notificationService.notifyUser(
                "6421100042",
                "หัวข้อทดสอบ",
                "ข้อความทดสอบ",
                "petitions",
                "PETITION"
        );

        assertNotNull(saved);
        assertEquals(555L, saved.getId());
        assertEquals("6421100042", saved.getRecipientUsername());
        assertEquals("6421100042", saved.getRecipientId());
        assertEquals("หัวข้อทดสอบ", saved.getTitle());
        assertEquals("ข้อความทดสอบ", saved.getMessage());
        assertEquals("petitions", saved.getTargetModule());
        assertEquals("PETITION", saved.getType());
        assertFalse(saved.isRead());
    }

    @Test
    @DisplayName("Model: recipientId alias getter and setter operate on recipientUsername")
    void testNotification_RecipientIdAlias() {
        Notification n = new Notification();
        n.setRecipientId("USER-123");
        assertEquals("USER-123", n.getRecipientId());
        assertEquals("USER-123", n.getRecipientUsername());
    }
}
