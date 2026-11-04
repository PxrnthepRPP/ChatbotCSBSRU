package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * One frequently asked question managed by the admin. A chat message that closely matches the
 * question (or one of its other phrasings) is answered with {@link #answer} as written when
 * {@link #exactAnswer} is on; a looser match is handed to the AI as reference material.
 */
@Entity
@Table(name = "faq_entries")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaqEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 100)
    private String category;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String question;

    /** Other ways people ask the same thing, one per line */
    @Column(columnDefinition = "TEXT")
    private String alternatives;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String answer;

    /** true: a close match gets this answer word for word; false: the AI words the answer from it */
    @Builder.Default
    @Column(nullable = false)
    private boolean exactAnswer = true;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    /** How many chat questions this FAQ answered or helped answer */
    @Builder.Default
    @Column(nullable = false)
    private long hitCount = 0;

    private LocalDateTime lastHitAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
