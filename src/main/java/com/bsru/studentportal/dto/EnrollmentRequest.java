package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Add a course to a student's timetable, either by course code (+ section number when the
 * course has several sections) or directly by sectionId.
 * academicYear/term default to the semester whose registration is currently open.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentRequest {
    private String courseCode;
    private String sectionNo;
    private Long sectionId;
    private Integer academicYear;
    private Integer term;
}
