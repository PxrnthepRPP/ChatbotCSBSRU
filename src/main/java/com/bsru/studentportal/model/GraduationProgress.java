package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Credits earned per curriculum category for one student.
 * Totals and the current GPA are derived (from these columns and course_grades), not stored.
 */
@Entity
@Table(name = "graduation_progress")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GraduationProgress {

    @Id
    @Column(name = "student_id", length = 10)
    private String studentId;

    // Read-only link; the row is keyed and written through studentId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", insertable = false, updatable = false)
    private Student student;

    @Column(name = "core_required", nullable = false)
    private Integer coreRequired;

    @Column(name = "core_earned", nullable = false)
    private Integer coreEarned;

    @Column(name = "ge_required", nullable = false)
    private Integer geRequired;

    @Column(name = "ge_earned", nullable = false)
    private Integer geEarned;

    @Column(name = "elective_required", nullable = false)
    private Integer electiveRequired;

    @Column(name = "elective_earned", nullable = false)
    private Integer electiveEarned;

    @Column(name = "free_required", nullable = false)
    private Integer freeRequired;

    @Column(name = "free_earned", nullable = false)
    private Integer freeEarned;

    @Column(name = "gpa_required", nullable = false)
    private Double gpaRequired;

    @Column(name = "activity_required", nullable = false)
    private Integer activityRequired;

    @Column(name = "activity_completed", nullable = false)
    private Integer activityCompleted;

    private String status;

    public int requiredCredits() {
        return coreRequired + geRequired + electiveRequired + freeRequired;
    }

    public int earnedCredits() {
        return coreEarned + geEarned + electiveEarned + freeEarned;
    }
}
