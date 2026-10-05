package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Create or update a class section. Times are "HH:mm"; dayOfWeek 0 = Monday ... 6 = Sunday. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SectionRequest {
    private Integer academicYear;
    private Integer term;
    private String courseCode;
    private String courseName;
    private Integer credits;
    private String sectionNo;
    private Integer dayOfWeek;
    private String startTime;
    private String endTime;
    private String room;
    /** Ignored for teachers: their own sections always use their own id */
    private String instructorId;
    private Integer capacity;
}
