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

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "advisor_id")
    private Advisor advisor;
}
