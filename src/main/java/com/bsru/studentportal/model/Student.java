package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "students")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Student {

    @Id
    @Column(name = "student_id", nullable = false, length = 10)
    private String studentId;

    @Column(name = "name_th", nullable = false)
    private String nameTh;

    @Column(name = "name_en", nullable = false)
    private String nameEn;

    private Integer year;

    private Double gpa;

    private String status;

    @Column(name = "career_path")
    private String careerPath;

    @Column(name = "employment_status")
    private String employmentStatus;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "salary_range")
    private String salaryRange;

    /** ปีที่เข้าศึกษา พ.ศ. (เช่น 2564) — auto-derived from studentId prefix if not set */
    @Column(name = "enrollment_year")
    private Integer enrollmentYear;

    /** ปีที่สำเร็จการศึกษา พ.ศ. (null ถ้ายังไม่จบ) */
    @Column(name = "graduation_year")
    private Integer graduationYear;

    /** วันเวลาที่อัปเดตสายอาชีพล่าสุด */
    @Column(name = "career_updated_at")
    private LocalDateTime careerUpdatedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "advisor_id")
    private Advisor advisor;

    /**
     * Auto-derive enrollmentYear from the first 2 digits of studentId (batch) if not set.
     * e.g. "6421100042" → batch "64" → enrollmentYear = 2564
     */
    @PrePersist
    public void prePersist() {
        if (this.enrollmentYear == null && this.studentId != null && this.studentId.length() >= 2) {
            try {
                int batch = Integer.parseInt(this.studentId.substring(0, 2));
                this.enrollmentYear = 2500 + batch;
            } catch (NumberFormatException ignored) {}
        }
    }

    public Student(String studentId, String nameTh, String nameEn, Integer year, Double gpa, String status, String careerPath, Advisor advisor) {
        this.studentId = studentId;
        this.nameTh = nameTh;
        this.nameEn = nameEn;
        this.year = year;
        this.gpa = gpa;
        this.status = status;
        this.careerPath = careerPath;
        this.advisor = advisor;
    }
}


