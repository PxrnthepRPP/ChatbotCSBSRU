package com.bsru.studentportal.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on @Scheduled jobs (e.g. GPA sync when a scheduled grade release time passes) */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
