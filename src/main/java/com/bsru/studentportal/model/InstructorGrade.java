package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A grade a teacher gave one student in one section. Hidden from students (and not counted in GPA)
 * until the admin releases the course (see CourseGradeSchedule).
 */
@Entity
@Table(name = "instructor_grades",
        uniqueConstraints = @UniqueConstraint(columnNames = {"section_id", "student_id"}))
@Data
@NoArgsConstructor
public class InstructorGrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "section_id", nullable = false)
    private ClassSection section;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    /** A, B+, B, C+, C, D+, D or F */
    @Column(length = 5, nullable = false)
    private String grade;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** Username of the teacher or admin who last set the grade */
    @Column(name = "updated_by", nullable = false, length = 50)
    private String updatedBy;
}
