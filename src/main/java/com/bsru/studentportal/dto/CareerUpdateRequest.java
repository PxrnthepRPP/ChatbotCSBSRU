package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CareerUpdateRequest {
    private String careerPath;
    private String employmentStatus;
    private String companyName;
    private String salaryRange;
}
