package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A student's graduation audit sheet: the curriculum tree (categories, groups, minimum credits,
 * rules) with the courses the student took and their results, stored as JSON.
 * Only raw data is stored; pass/fail, credits and GPA are computed by GraduationAuditService,
 * so the web page and the chatbot always show the same result.
 */
@Entity
@Table(name = "graduation_audits")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GraduationAudit {

    @Id
    @Column(name = "student_id", length = 10)
    private String studentId;

    @Column(nullable = false, columnDefinition = "text")
    private String data;
}
