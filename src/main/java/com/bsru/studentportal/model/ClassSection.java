package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

/**
 * One weekly class meeting of a course in one semester, created by an admin or the teacher.
 * Students are linked to it through SectionEnrollment, so changing the day, time or room here
 * changes the timetable of every enrolled student at once.
 */
@Entity
@Table(name = "class_sections",
        uniqueConstraints = @UniqueConstraint(columnNames = {"academic_year", "term", "course_code", "section_no"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClassSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Buddhist Era year, e.g. 2566 */
    @Column(name = "academic_year", nullable = false)
    private Integer academicYear;

    @Column(nullable = false)
    private Integer term;

    @Column(name = "course_code", nullable = false, length = 20)
    private String courseCode;

    @Column(name = "course_name", nullable = false)
    private String courseName;

    @Column(nullable = false)
    private Integer credits;

    @Column(name = "section_no", nullable = false, length = 10)
    private String sectionNo;

    /** 0 = Monday ... 6 = Sunday (same as the timetable page) */
    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    private String room;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "instructor_id")
    private Advisor instructor;

    /** null = unlimited seats */
    private Integer capacity;

    /**
     * Teachers request sections (PENDING); students can only enroll once an admin APPROVES them.
     * The column default makes sections created before this field existed count as approved.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 20,
            columnDefinition = "varchar(20) default 'APPROVED' not null")
    private ApprovalStatus approvalStatus = ApprovalStatus.APPROVED;

    /** Admin's reason when rejecting a request */
    @Column(name = "review_note")
    private String reviewNote;

    /** Comma-separated prerequisite course codes, e.g. 'CS101,CS102' */
    @Column(name = "prerequisite_course_codes")
    private String prerequisiteCourseCodes;

    public ClassSection(Long id, Integer academicYear, Integer term, String courseCode, String courseName,
                        Integer credits, String sectionNo, Integer dayOfWeek, LocalTime startTime, LocalTime endTime,
                        String room, Advisor instructor, Integer capacity, ApprovalStatus approvalStatus,
                        String reviewNote) {
        this(id, academicYear, term, courseCode, courseName, credits, sectionNo, dayOfWeek, startTime, endTime,
                room, instructor, capacity, approvalStatus, reviewNote, null);
    }

    public String getPrerequisiteCourseCodes() {
        return prerequisiteCourseCodes;
    }

    public void setPrerequisiteCourseCodes(String prerequisiteCourseCodes) {
        this.prerequisiteCourseCodes = prerequisiteCourseCodes;
    }

    public enum ApprovalStatus { PENDING, APPROVED, REJECTED }
}

