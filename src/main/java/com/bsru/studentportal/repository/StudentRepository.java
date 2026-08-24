package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentRepository extends JpaRepository<Student, String> {
    List<Student> findByAdvisorId(String advisorId);
    List<Student> findByYear(Integer year);
    List<Student> findByStatus(String status);
}
