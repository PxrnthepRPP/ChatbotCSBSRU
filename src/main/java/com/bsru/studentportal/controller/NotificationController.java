package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.NotificationListResponse;
import com.bsru.studentportal.model.Notification;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> getNotifications(Authentication auth) {
        if (!CurrentUser.isLoggedIn(auth)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)"));
        }
        NotificationListResponse response = notificationService.getNotificationsForUser(auth);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id, Authentication auth) {
        if (!CurrentUser.isLoggedIn(auth)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)"));
        }
        Notification notification = notificationService.markAsRead(id, auth);
        return ResponseEntity.ok(notification);
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(Authentication auth) {
        if (!CurrentUser.isLoggedIn(auth)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)"));
        }
        int markedCount = notificationService.markAllAsRead(auth);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "ทำเครื่องหมายอ่านแล้วทั้งหมดเรียบร้อย",
                "markedCount", markedCount
        ));
    }
}
