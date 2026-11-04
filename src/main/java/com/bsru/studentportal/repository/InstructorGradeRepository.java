package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.InstructorGrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstructorGradeRepository extends JpaRepository<InstructorGrade, Long> {
    List<InstructorGrade> findBySectionId(Long sectionId);
    List<InstructorGrade> findByStudentStudentId(String studentId);
    Optional<InstructorGrade> findBySectionIdAndStudentStudentId(Long sectionId, String studentId);
    void deleteBySectionId(Long sectionId);
}
