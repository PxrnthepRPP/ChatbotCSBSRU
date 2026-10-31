package com.bsru.studentportal.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(
                        "http://localhost",
                        "http://localhost:*",
                        "https://localhost",
                        "https://localhost:*",
                        "http://127.0.0.1",
                        "http://127.0.0.1:*",
                        "https://127.0.0.1",
                        "https://127.0.0.1:*",
                        "http://192.168.*:*",
                        "http://192.168.*",
                        "https://192.168.*:*",
                        "https://192.168.*",
                        "http://10.*:*",
                        "http://10.*",
                        "https://10.*:*",
                        "https://10.*",
                        "http://172.*:*",
                        "http://172.*",
                        "https://172.*:*",
                        "https://172.*"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition", "Authorization")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
