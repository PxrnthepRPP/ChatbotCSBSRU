package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PetitionRequest {
    private String type;
    private String title;
    private String details;
    private String attachment;
    private String studentId;
}
