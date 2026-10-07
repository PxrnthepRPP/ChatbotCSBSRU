package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Admin settings for the grades of one course in one term (every Sec together): the deadline for
 * teachers to send grades, and when the grades are released to students and counted in GPA.
 */
@Entity
@Table(name = "course_grade_schedules",
        uniqueConstraints = @UniqueConstraint(columnNames = {"academic_year", "term", "course_code"}))
@Data
@NoArgsConstructor
public class CourseGradeSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "academic_year", nullable = false)
    private Integer academicYear;

    @Column(nullable = false)
    private Integer term;

    @Column(name = "course_code", nullable = false, length = 20)
    private String courseCode;

    /** Teachers may change and send grades until this time; null = no deadline yet */
    @Column(name = "submit_deadline")
    private LocalDateTime submitDeadline;

    /** Grades are visible to students and counted from this time; null = not released */
    @Column(name = "release_at")
    private LocalDateTime releaseAt;
}
