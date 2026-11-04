package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Who may look back at their own earlier chats. A row is either a role default
 * ("role:STUDENT") or a per-person override ("person:student:6421100042"); the override wins.
 * Nobody sees anyone else's chats through this (the admin reads them on the admin page).
 */
@Entity
@Table(name = "chat_history_access")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistoryAccess {

    @Id
    @Column(name = "access_key", length = 120)
    private String accessKey;

    @Column(nullable = false)
    private boolean allowed;

    private LocalDateTime updatedAt;
}
