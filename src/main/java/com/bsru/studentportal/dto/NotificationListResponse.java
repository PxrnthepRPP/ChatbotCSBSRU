package com.bsru.studentportal.dto;

import com.bsru.studentportal.model.Notification;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationListResponse {
    private List<Notification> notifications;
    private long unreadCount;
}
