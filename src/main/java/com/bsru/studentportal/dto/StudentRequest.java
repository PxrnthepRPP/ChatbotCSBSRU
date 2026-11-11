package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Admin create / update of a student record. On update, null fields are left unchanged. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentRequest {
    private String studentId;
    private String nameTh;
    private String nameEn;
    private Integer year;
    private Double gpa;
    private String status;
    private String advisorId;
    private String studentSection;
    private String careerPath;
    private String employmentStatus;
    private String companyName;
    private String salaryRange;
    /** true = sample record (no login account, no grades); only used when creating */
    private Boolean simulated;
    /** 13-digit Thai national ID; required for a real (not simulated) new student, blank on edit = keep */
    private String nationalId;
}
