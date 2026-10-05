package com.bsru.studentportal.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

/** Reads who is calling from the verified JWT authentication. */
public final class CurrentUser {

    /** The demo "student" login is student 6421100042 (same mapping as AuthController) */
    public static final String DEMO_STUDENT_ID = "6421100042";

    private CurrentUser() {}

    public static boolean isLoggedIn(Authentication auth) {
        return auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken);
    }

    public static boolean hasRole(Authentication auth, String role) {
        return isLoggedIn(auth) && auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }

    /** The demo "advisor" login acts as advisor ADV-01 when managing sections */
    public static final String DEMO_ADVISOR_ID = "ADV-01";

    public static boolean isAdmin(Authentication auth) {
        return hasRole(auth, "ROLE_ADMIN");
    }

    /** The caller's advisor id, or empty when the caller is not a logged-in advisor. */
    public static Optional<String> advisorId(Authentication auth) {
        if (!hasRole(auth, "ROLE_ADVISOR")) return Optional.empty();
        String username = auth.getName();
        return Optional.of("advisor".equalsIgnoreCase(username) ? DEMO_ADVISOR_ID : username);
    }

    /** The caller's student id, or empty when the caller is not a logged-in student. */
    public static Optional<String> studentId(Authentication auth) {
        if (!hasRole(auth, "ROLE_STUDENT")) return Optional.empty();
        String username = auth.getName();
        return Optional.of("student".equalsIgnoreCase(username) ? DEMO_STUDENT_ID : username);
    }
}
