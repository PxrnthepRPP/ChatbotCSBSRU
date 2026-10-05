package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Admin decision on students' registration requests: status CONFIRMED or REJECTED (note required). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentReviewRequest {
    private List<Long> enrollmentIds;
    private String status;
    private String note;
}
