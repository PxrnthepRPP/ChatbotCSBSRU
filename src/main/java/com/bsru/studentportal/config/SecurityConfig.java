package com.bsru.studentportal.config;

import com.bsru.studentportal.security.ChatRateLimitFilter;
import com.bsru.studentportal.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    /** อ่านจาก env APP_CORS_ORIGINS (ผ่าน app.cors.allowed-origins ใน application.properties) */
    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Bean
    public ChatRateLimitFilter chatRateLimitFilter() {
        return new ChatRateLimitFilter();
    }

    @Bean
    public FilterRegistrationBean<ChatRateLimitFilter> chatRateLimitFilterRegistration(ChatRateLimitFilter filter) {
        FilterRegistrationBean<ChatRateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json;charset=UTF-8");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"error\":\"กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"error\":\"คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Forbidden)\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/health", "/api/chat/**", "/api/forms/**", "/api/uploads/forms/**", "/error").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(chatRateLimitFilter(), JwtAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS มีที่เดียวคือที่นี่ (ลบ CorsConfig แบบ WebMvcConfigurer ออกแล้ว)
     * APP_CORS_ORIGINS = รายการ origin pattern คั่นด้วย comma เช่น https://portal.bsru.ac.th,https://*.bsru.ac.th
     * ถ้าไม่ตั้ง: อนุญาตเฉพาะ localhost / 127.0.0.1 / IP ภายใน 192.168.x.x, 10.x.x.x, 172.16-31.x.x
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> configuredOrigins = parseOrigins(corsAllowedOrigins);

        CorsConfiguration configuration;
        if (configuredOrigins.isEmpty()) {
            configuration = new LocalNetworkCorsConfiguration();
        } else {
            if (configuredOrigins.contains("*")) {
                log.warn("APP_CORS_ORIGINS contains '*': every website may call this API with credentials. "
                        + "List the real frontend origins instead.");
            }
            configuration = new CorsConfiguration();
            configuration.setAllowedOriginPatterns(configuredOrigins);
        }
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Content-Disposition", "Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    static List<String> parseOrigins(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /**
     * origin ค่าเริ่มต้นสำหรับพัฒนาในเครื่อง/วง LAN — ตรวจรูป IP ครบทุกส่วน
     * (wildcard แบบ http://192.168.* จะยอม http://192.168.1.attacker.com ด้วย จึงไม่ใช้)
     */
    static final Pattern LOCAL_NETWORK_ORIGIN = Pattern.compile(
            "^https?://(localhost"
                    + "|127\\.0\\.0\\.1"
                    + "|192\\.168\\.\\d{1,3}\\.\\d{1,3}"
                    + "|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"
                    + "|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})"
                    + "(:\\d{1,5})?$",
            Pattern.CASE_INSENSITIVE);

    /** ใช้เมื่อไม่ได้ตั้ง APP_CORS_ORIGINS: ยอมเฉพาะ origin ที่ตรงกับ LOCAL_NETWORK_ORIGIN */
    static final class LocalNetworkCorsConfiguration extends CorsConfiguration {
        @Override
        public String checkOrigin(String origin) {
            if (origin == null || origin.isBlank()) return null;
            String trimmed = origin.trim();
            return LOCAL_NETWORK_ORIGIN.matcher(trimmed).matches() ? trimmed : null;
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
