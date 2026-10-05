package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * When students may add or drop their own courses for one semester.
 * Open only between opensAt and closesAt, and only while an admin has not force-closed it.
 */
@Entity
@Table(name = "registration_periods",
        uniqueConstraints = @UniqueConstraint(columnNames = {"academic_year", "term"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "academic_year", nullable = false)
    private Integer academicYear;

    @Column(nullable = false)
    private Integer term;

    @Column(name = "opens_at", nullable = false)
    private LocalDateTime opensAt;

    @Column(name = "closes_at", nullable = false)
    private LocalDateTime closesAt;

    @Column(name = "force_closed", nullable = false)
    private boolean forceClosed;

    public boolean isOpenAt(LocalDateTime now) {
        return !forceClosed && !now.isBefore(opensAt) && now.isBefore(closesAt);
    }
}
