package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.StudentActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentActivityRepository extends JpaRepository<StudentActivity, Long> {
    List<StudentActivity> findByStudentIdOrderByAcademicYearDescCreatedAtDesc(String studentId);
    List<StudentActivity> findByStudentIdAndActivityCategoryId(String studentId, String activityCategoryId);
    long countByStudentId(String studentId);
    void deleteByIdAndStudentId(Long id, String studentId);
}
