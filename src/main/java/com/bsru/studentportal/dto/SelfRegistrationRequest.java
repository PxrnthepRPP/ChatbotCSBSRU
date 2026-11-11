package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A student registers a course by typing it in themselves. Times are "HH:mm" (minutes allowed);
 * dayOfWeek 0 = Monday ... 6 = Sunday. academicYear/term default to the semester whose registration
 * is open, sectionNo to the student's own Sec. The teacher is either an advisor in the system
 * (instructorId) or a name typed by hand (instructorName).
 *
 * If the same course + Sec already exists in that semester the request is refused with 409 and the
 * existing section, unless useExisting is true: then the student is registered into that section.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SelfRegistrationRequest {
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
    private String instructorId;
    private String instructorName;
    private boolean useExisting;
}
