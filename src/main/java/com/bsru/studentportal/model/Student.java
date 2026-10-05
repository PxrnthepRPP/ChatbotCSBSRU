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

import java.time.LocalDate;

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

    /** Student group (D1 or D2), set by an admin; students register only in sections of their own group */
    @Column(name = "student_section", nullable = false, length = 5,
            columnDefinition = "varchar(5) default 'D1' not null")
    private String studentSection = "D1";

    /**
     * Sample record for showing the dashboards (the old demo list): basic data only, no grades,
     * graduation audit or login account. Admins and the student's advisor may add / delete these.
     */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean simulated;

    // ---- Profile (shown on the student's "ประวัตินักศึกษา" page and in the advisor's history view) ----
    private String email;

    private String phone;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    private String religion;

    @Column(length = 500)
    private String address;

    /** Buddhist Era year of admission, e.g. 2564 */
    @Column(name = "admission_year")
    private Integer admissionYear;

    private String faculty;

    private String department;

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


