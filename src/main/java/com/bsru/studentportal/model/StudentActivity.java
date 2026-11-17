package com.bsru.studentportal.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Student Activity Record — represents an activity participation registered by the student
 * or loaded from academic history, mapped to one of the 17 official BSRU activity criteria.
 */
@Entity
@Table(name = "student_activities")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false, length = 20)
    private String studentId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", insertable = false, updatable = false)
    private Student student;

    @Column(name = "activity_category_id", nullable = false, length = 50)
    private String activityCategoryId; // e.g. "uni-orient", "public-mind", etc.

    @Column(name = "category_name", nullable = false, length = 100)
    private String categoryName; // e.g. "จิตสาธารณะ"

    @Column(name = "category_group", nullable = false, length = 100)
    private String categoryGroup; // e.g. "จิตสาธารณะ/ชมรม", "มหาวิทยาลัย"

    @Column(nullable = false, length = 255)
    private String title; // ชื่อของกิจกรรม

    @Column(name = "academic_year", nullable = false, length = 10)
    private String academicYear; // e.g. "2566", "2567", "2568"

    @Column(name = "activity_date", length = 50)
    private String activityDate; // e.g. "27/9/2566" หรือ "2026-09-27"

    @Column(nullable = false)
    private Integer count = 1; // จำนวน (ครั้ง)

    private Integer hours; // ชั่วโมงจิตสาธารณะ (null สำหรับหมวดอื่น)

    @Column(nullable = false, length = 100)
    private String status = "ผ่าน"; // "ผ่าน", "รอตรวจสอบ"

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
