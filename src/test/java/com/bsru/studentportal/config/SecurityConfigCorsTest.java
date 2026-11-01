package com.bsru.studentportal.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Default (dev) CORS origins: localhost and private LAN only")
class SecurityConfigCorsTest {

    private final SecurityConfig.LocalNetworkCorsConfiguration config = new SecurityConfig.LocalNetworkCorsConfiguration();

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost", "http://localhost:3000", "https://localhost:8443",
            "http://127.0.0.1", "http://127.0.0.1:5500",
            "http://192.168.1.20", "http://192.168.0.5:8080",
            "http://10.0.0.1", "https://10.20.30.40:443",
            "http://172.16.0.1", "http://172.31.255.255:3000"
    })
    void allowsLocalAndPrivateNetworkOrigins(String origin) {
        assertEquals(origin, config.checkOrigin(origin));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://172.32.0.1", "http://172.15.0.1", "http://172.217.1.1",
            "http://192.168.1.attacker.com", "http://10.evil.example", "http://localhost.attacker.com",
            "https://bsru.attacker.com", "null", "http://192.169.1.1"
    })
    void rejectsPublicOrLookalikeOrigins(String origin) {
        assertNull(config.checkOrigin(origin));
    }

    @Test
    void parsesCommaSeparatedEnvValue() {
        assertEquals(List.of("https://portal.bsru.ac.th", "https://*.bsru.ac.th"),
                SecurityConfig.parseOrigins(" https://portal.bsru.ac.th , https://*.bsru.ac.th ,"));
        assertTrue(SecurityConfig.parseOrigins("").isEmpty());
        assertTrue(SecurityConfig.parseOrigins(null).isEmpty());
    }
}
