package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.Advisor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdvisorRepository extends JpaRepository<Advisor, String> {
    List<Advisor> findByDepartment(String department);
}
