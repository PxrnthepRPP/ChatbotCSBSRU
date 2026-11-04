package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * The courses a student picked for one semester, checked together (seats, clashes)
 * and then sent in one go as registration requests for an admin to confirm.
 * sections maps a course code to the Sec picked for it; a course without one gets the first Sec that fits.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationCartRequest {
    private Integer academicYear;
    private Integer term;
    private List<String> courseCodes;
    private Map<String, String> sections;

    /** No Sec picked for any course: each gets the first Sec that fits */
    public RegistrationCartRequest(Integer academicYear, Integer term, List<String> courseCodes) {
        this(academicYear, term, courseCodes, null);
    }
}
