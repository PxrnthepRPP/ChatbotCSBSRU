package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.AcademicPetition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AcademicPetitionRepository extends JpaRepository<AcademicPetition, String> {
    List<AcademicPetition> findByStudentStudentId(String studentId);
    List<AcademicPetition> findByStatus(String status);
}
