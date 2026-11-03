package com.bsru.studentportal.service;

import com.bsru.studentportal.dto.NotificationListResponse;
import com.bsru.studentportal.model.Notification;
import com.bsru.studentportal.repository.NotificationRepository;
import com.bsru.studentportal.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;

    /**
     * Resolves all applicable username/ID aliases for the authenticated caller.
     * Maps "student" <-> "6621100042", "advisor" <-> "ADV-01", and "admin".
     */
    public Set<String> resolveRecipientKeys(Authentication auth) {
        Set<String> keys = new LinkedHashSet<>();
        if (!CurrentUser.isLoggedIn(auth)) {
            return keys;
        }
        String name = auth.getName();
        if (name != null && !name.isBlank()) {
            keys.add(name);
        }
        if (CurrentUser.isAdmin(auth)) {
            keys.add("admin");
        }
        CurrentUser.studentId(auth).ifPresent(sid -> {
            keys.add(sid);
            keys.add("student");
        });
        CurrentUser.advisorId(auth).ifPresent(aid -> {
            keys.add(aid);
            keys.add("advisor");
        });
        return keys;
    }

    /**
     * Emits an in-app notification with specific category type.
     */
    @Transactional
    public Notification notifyUser(String recipient, String title, String message, String targetModule, String type) {
        if (recipient == null || recipient.isBlank()) {
            log.warn("Attempted to send notification with empty recipient");
            return null;
        }
        Notification notification = Notification.builder()
                .recipientUsername(recipient.trim())
                .title(title != null ? title.trim() : "")
                .message(message != null ? message.trim() : "")
                .targetModule(targetModule != null ? targetModule.trim() : null)
                .type(type != null ? type.trim() : "SYSTEM")
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
        Notification saved = notificationRepository.save(notification);
        log.info("Notification [{}] sent to [{}]: {}", saved.getId(), recipient, title);
        return saved;
    }

    /**
     * Overload for backward-compatibility or generic events.
     */
    @Transactional
    public Notification notifyUser(String recipient, String title, String message, String targetModule) {
        return notifyUser(recipient, title, message, targetModule, "SYSTEM");
    }

    /**
     * Retrieves the 30 latest notifications and unread count for the authenticated user.
     */
    @Transactional(readOnly = true)
    public NotificationListResponse getNotificationsForUser(Authentication auth) {
        Set<String> keys = resolveRecipientKeys(auth);
        if (keys.isEmpty()) {
            return new NotificationListResponse(Collections.emptyList(), 0);
        }
        List<Notification> list = notificationRepository.findTop30ByRecipientUsernameInOrderByCreatedAtDesc(keys);
        long unread = notificationRepository.countByRecipientUsernameInAndIsReadFalse(keys);
        return new NotificationListResponse(list, unread);
    }

    /**
     * Marks a notification as read with strict authorization checks.
     */
    @Transactional
    public Notification markAsRead(Long id, Authentication auth) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found: " + id));

        Set<String> keys = resolveRecipientKeys(auth);
        boolean isAuthorized = CurrentUser.isAdmin(auth) || keys.contains(notification.getRecipientUsername());
        if (!isAuthorized) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to modify this notification");
        }

        if (!notification.isRead()) {
            notification.setRead(true);
            notification = notificationRepository.save(notification);
        }
        return notification;
    }

    /**
     * Marks all unread notifications for the authenticated caller as read.
     */
    @Transactional
    public int markAllAsRead(Authentication auth) {
        Set<String> keys = resolveRecipientKeys(auth);
        if (keys.isEmpty()) {
            return 0;
        }
        return notificationRepository.markAllAsReadByRecipientUsernames(keys);
    }
}
