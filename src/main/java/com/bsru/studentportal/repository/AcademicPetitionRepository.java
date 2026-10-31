package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.AcademicPetition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AcademicPetitionRepository extends JpaRepository<AcademicPetition, String> {

    List<AcademicPetition> findByStudentStudentId(String studentId);

    List<AcademicPetition> findByStudentStudentIdOrderBySubmittedAtDesc(String studentId);

    @Query("SELECT p FROM AcademicPetition p WHERE p.student.studentId = :studentId ORDER BY p.submittedAt DESC")
    List<AcademicPetition> findByStudentId(@Param("studentId") String studentId);

    @Query("SELECT p FROM AcademicPetition p WHERE p.student.advisor.id = :advisorId ORDER BY p.submittedAt DESC")
    List<AcademicPetition> findByStudentAdvisorId(@Param("advisorId") String advisorId);

    @Query("SELECT p FROM AcademicPetition p WHERE p.student.advisor.id = :advisorId ORDER BY p.submittedAt DESC")
    List<AcademicPetition> findByStudentAdvisorIdOrderBySubmittedAtDesc(@Param("advisorId") String advisorId);

    List<AcademicPetition> findByStatus(String status);

    @Query("SELECT p.id FROM AcademicPetition p WHERE p.id LIKE :prefix")
    List<String> findPetitionIdsStartingWith(@Param("prefix") String prefix);
}
