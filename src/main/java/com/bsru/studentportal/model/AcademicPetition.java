package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "academic_petitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AcademicPetition {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String details;

    private String attachment;

    @Column(name = "attachment_path")
    private String attachmentPath;

    @Column(name = "attachment_name")
    private String attachmentName;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    private String status;

    @Column(name = "advisor_comment", columnDefinition = "TEXT")
    private String advisorComment;

    @Column(name = "advisor_reviewed_at")
    private LocalDateTime advisorReviewedAt;

    @Column(name = "admin_comment", columnDefinition = "TEXT")
    private String adminComment;

    @Column(name = "admin_reviewed_at")
    private LocalDateTime adminReviewedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id")
    private Student student;

    public AcademicPetition(String id, String type, String title, String details, String attachment,
                            LocalDateTime submittedAt, String status, String adminComment, Student student) {
        this.id = id;
        this.type = type;
        this.title = title;
        this.details = details;
        this.attachment = attachment;
        this.submittedAt = submittedAt;
        this.status = status;
        this.adminComment = adminComment;
        this.student = student;
    }
}
