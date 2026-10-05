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
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One course a student registered in one semester.
 * grade / gradePoint are null while the result has not been released yet.
 */
@Entity
@Table(name = "course_grades",
        uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "academic_year", "term", "course_code"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CourseGrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    /** Buddhist Era year, e.g. 2566 */
    @Column(name = "academic_year", nullable = false)
    private Integer academicYear;

    /** 1, 2 or 3 (summer) */
    @Column(nullable = false)
    private Integer term;

    @Column(name = "course_code", nullable = false, length = 20)
    private String courseCode;

    @Column(name = "course_name", nullable = false)
    private String courseName;

    @Column(nullable = false)
    private Integer credits;

    @Column(length = 5)
    private String grade;

    @Column(name = "grade_point")
    private Double gradePoint;
}
