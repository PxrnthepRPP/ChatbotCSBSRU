package com.bsru.studentportal.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JWT secret must be configured and long enough")
class JwtUtilSecretValidationTest {

    @Test
    void missingSecretFailsFastWithHint() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> new JwtUtil("", 1000L));
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
        assertThrows(IllegalStateException.class, () -> new JwtUtil(null, 1000L));
        assertThrows(IllegalStateException.class, () -> new JwtUtil("   ", 1000L));
    }

    @Test
    void secretShorterThan32BytesIsRejected() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> new JwtUtil("x".repeat(31), 1000L));
        assertTrue(ex.getMessage().contains("32"));
    }

    @Test
    void validSecretSignsAndVerifiesTokens() {
        JwtUtil jwtUtil = new JwtUtil("0123456789abcdef0123456789abcdef", 60_000L);
        String token = jwtUtil.generateToken("6621100042", "ROLE_STUDENT", Map.of());
        assertEquals("6621100042", jwtUtil.extractUsername(token));
        assertTrue(jwtUtil.isTokenValid(token));

        JwtUtil otherKey = new JwtUtil("fedcba9876543210fedcba9876543210", 60_000L);
        assertFalse(otherKey.isTokenValid(token), "token signed with another secret must be rejected");
    }
}
