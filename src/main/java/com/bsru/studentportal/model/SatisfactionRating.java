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

/** One answer to "how satisfied are you with the chatbot?" (3 levels) */
@Entity
@Table(name = "satisfaction_ratings", indexes = {
        @Index(name = "idx_satisfaction_time", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SatisfactionRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "person_key", length = 100, nullable = false)
    private String personKey;

    @Column(length = 20, nullable = false)
    private String role;

    /** 1 = ไม่พอใจ, 2 = พอใช้, 3 = พอใจมาก */
    @Column(nullable = false)
    private int level;

    /** IDLE (5 minutes without activity) or CLOSE (the chat was closed) */
    @Column(name = "trigger_type", length = 10)
    private String trigger;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
