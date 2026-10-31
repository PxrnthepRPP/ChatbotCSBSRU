package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PetitionStatusUpdateRequest {
    private String status;
    private String comment;
    private String advisorComment;
    private String adminComment;

    public PetitionStatusUpdateRequest(String status, String adminComment) {
        this.status = status;
        this.adminComment = adminComment;
    }
}
