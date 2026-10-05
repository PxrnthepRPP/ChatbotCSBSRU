package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Login account. The username is what people type on the login page: "admin", the demo aliases
 * "advisor" / "student", an advisor id (ADV-01) or a 10-digit student id. Passwords are BCrypt hashes.
 */
@Entity
@Table(name = "user_accounts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAccount {

    @Id
    @Column(length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** ROLE_ADMIN, ROLE_ADVISOR or ROLE_STUDENT */
    @Column(nullable = false, length = 20)
    private String role;

    @Column(name = "failed_attempts", nullable = false, columnDefinition = "integer default 0 not null")
    private int failedAttempts;

    /** Set after too many wrong passwords; login is refused until then */
    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    /** New accounts and reset passwords must be changed at the next login */
    @Column(name = "must_change_password", nullable = false, columnDefinition = "boolean default false not null")
    private boolean mustChangePassword;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
}
