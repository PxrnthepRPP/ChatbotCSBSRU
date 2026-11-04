package com.bsru.studentportal.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_history_entries", indexes = {
        @Index(name = "idx_chat_history_session", columnList = "session_id"),
        @Index(name = "idx_chat_history_user_key", columnList = "user_key"),
        @Index(name = "idx_chat_history_timestamp", columnList = "timestamp")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistoryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", length = 100, nullable = false)
    private String sessionId;

    @Column(name = "user_key", length = 100)
    private String userKey;

    /** "USER" or "BOT" */
    @Column(length = 20, nullable = false)
    private String sender;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    /** Stored as JSON array string e.g. ["curriculum.pdf"] */
    @Column(columnDefinition = "TEXT")
    private String sources;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (this.timestamp == null) {
            this.timestamp = LocalDateTime.now();
        }
    }

    // --- Backward & Frontend compatibility accessors ---
    @JsonProperty("role")
    public String getRole() {
        return sender != null ? sender.toLowerCase() : "bot";
    }

    @JsonProperty("messageText")
    public String getMessageText() {
        return message;
    }

    @JsonProperty("createdAt")
    public LocalDateTime getCreatedAt() {
        return timestamp;
    }
}
