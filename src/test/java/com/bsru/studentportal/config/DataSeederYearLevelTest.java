package com.bsru.studentportal.config;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DataSeederYearLevelTest {

    @Test
    void academicYearStartsInJune() {
        assertEquals(2569, DataSeeder.currentAcademicYearBE(LocalDate.of(2026, 11, 4)));  // term 2/2569
        assertEquals(2569, DataSeeder.currentAcademicYearBE(LocalDate.of(2026, 6, 1)));
        assertEquals(2568, DataSeeder.currentAcademicYearBE(LocalDate.of(2026, 5, 31))); // still 2/2568 + summer
    }

    @Test
    void yearLevelFollowsBatchAndIsClamped() {
        int now = DataSeeder.currentAcademicYearBE(LocalDate.now());
        int batch = now - 2500;                     // admitted this academic year
        assertEquals(1, DataSeeder.yearLevelFromId(batch + "21100001", 9));
        assertEquals(4, DataSeeder.yearLevelFromId((batch - 3) + "21100001", 9));
        assertEquals(8, DataSeeder.yearLevelFromId((batch - 20) + "21100001", 9));
        assertEquals(1, DataSeeder.yearLevelFromId((batch + 1) + "21100001", 9)); // future batch
        assertEquals(9, DataSeeder.yearLevelFromId("ABC", 9));
        assertEquals(9, DataSeeder.yearLevelFromId(null, 9));
    }
}
