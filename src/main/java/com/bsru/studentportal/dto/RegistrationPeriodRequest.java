package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Times are local date-times, e.g. "2026-10-05T08:00". */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationPeriodRequest {
    private Integer academicYear;
    private Integer term;
    private String opensAt;
    private String closesAt;
    private Boolean forceClosed;
}
