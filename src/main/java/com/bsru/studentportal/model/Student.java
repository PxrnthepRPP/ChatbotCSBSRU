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

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "advisor_id")
    private Advisor advisor;

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


