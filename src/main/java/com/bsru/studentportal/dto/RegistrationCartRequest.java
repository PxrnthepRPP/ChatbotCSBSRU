package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The courses a student picked for one semester, checked together (seats, clashes, own Sec)
 * and then sent in one go as registration requests for an admin to confirm.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationCartRequest {
    private Integer academicYear;
    private Integer term;
    private List<String> courseCodes;
}
