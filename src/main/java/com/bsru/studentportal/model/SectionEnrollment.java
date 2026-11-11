package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A student registered in a class section. */
@Entity
@Table(name = "section_enrollments",
        uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "section_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SectionEnrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "section_id", nullable = false)
    private ClassSection section;

    @Column(name = "enrolled_at", nullable = false)
    private LocalDateTime enrolledAt;

    /**
     * Registration is confirmed as soon as the student saves it (CONFIRMED). PENDING/REJECTED are
     * legacy values from the old admin-approval flow, kept so old rows still map.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'CONFIRMED' not null")
    private EnrollmentStatus status = EnrollmentStatus.CONFIRMED;

    /** Admin's reason when rejecting the request */
    @Column(name = "review_note")
    private String reviewNote;

    public enum EnrollmentStatus { PENDING, CONFIRMED, REJECTED }
}
