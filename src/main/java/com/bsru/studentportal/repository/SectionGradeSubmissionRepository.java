package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.SectionGradeSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SectionGradeSubmissionRepository extends JpaRepository<SectionGradeSubmission, Long> {
}
