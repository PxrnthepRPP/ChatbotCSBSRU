package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityRegisterRequest {
    private String activityCategoryId;
    private String title;
    private String academicYear;
    private String activityDate;
    private Integer count = 1;
    private Integer hours;
}
