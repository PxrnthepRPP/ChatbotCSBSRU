package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.CourseGrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CourseGradeRepository extends JpaRepository<CourseGrade, Long> {
    List<CourseGrade> findByStudentStudentIdOrderByAcademicYearDescTermDescCourseCodeAsc(String studentId);
}
