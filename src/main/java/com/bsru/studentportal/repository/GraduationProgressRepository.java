package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.GraduationProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GraduationProgressRepository extends JpaRepository<GraduationProgress, String> {
}
