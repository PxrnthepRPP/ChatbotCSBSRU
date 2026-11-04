package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Permanent copy of every chat message. The chat panel still starts empty on every login
 * (chat_history_entries is cleared), but this archive is kept for the admin's usage statistics,
 * for users allowed to look back at their own chats, and so the AI can recall the person's
 * earlier conversations. Rows are only ever read per person.
 */
@Entity
@Table(name = "chat_log_entries", indexes = {
        @Index(name = "idx_chat_log_person", columnList = "person_key"),
        @Index(name = "idx_chat_log_time", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatLogEntry {

    public static final String USER = "USER";
    public static final String BOT = "BOT";

    /** Where an answer came from (set on both the question and its answer) */
    public enum Source { FAQ_EXACT, FAQ_SUGGESTED, AI, FALLBACK, NO_ANSWER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** student:<id>, advisor:<id>, staff:<username> or guest:<browser id> */
    @Column(name = "person_key", length = 100, nullable = false)
    private String personKey;

    /** STUDENT, ADVISOR, ADMIN or GUEST */
    @Column(length = 20, nullable = false)
    private String role;

    /** USER or BOT */
    @Column(length = 10, nullable = false)
    private String sender;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(length = 20)
    private String source;

    private Long faqId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
