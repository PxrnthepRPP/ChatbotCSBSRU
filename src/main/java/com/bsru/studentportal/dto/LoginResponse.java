package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private String username;
    private String role;
    private String displayName;
    private String userId;
    private long expiresIn;
    /** The account uses a first / reset password that must be changed now */
    private boolean mustChangePassword;
    /** Advisor has admin privilege */
    private boolean canAdmin;
}
