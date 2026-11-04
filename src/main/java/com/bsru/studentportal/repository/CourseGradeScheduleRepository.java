package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.CourseGradeSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseGradeScheduleRepository extends JpaRepository<CourseGradeSchedule, Long> {
    Optional<CourseGradeSchedule> findByAcademicYearAndTermAndCourseCodeIgnoreCase(Integer academicYear, Integer term, String courseCode);
    List<CourseGradeSchedule> findByAcademicYearAndTerm(Integer academicYear, Integer term);
}
