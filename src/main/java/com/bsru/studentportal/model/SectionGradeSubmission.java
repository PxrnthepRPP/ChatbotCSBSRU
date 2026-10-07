package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A teacher pressed "ส่งเกรด" for a section. Any later change by the teacher removes it (must send again). */
@Entity
@Table(name = "section_grade_submissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SectionGradeSubmission {

    @Id
    @Column(name = "section_id", nullable = false)
    private Long sectionId;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;

    @Column(name = "submitted_by", nullable = false, length = 50)
    private String submittedBy;
}
