package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.CohortAdvisor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CohortAdvisorRepository extends JpaRepository<CohortAdvisor, Integer> {
}
