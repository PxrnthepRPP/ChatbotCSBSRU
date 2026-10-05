package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.GraduationAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GraduationAuditRepository extends JpaRepository<GraduationAudit, String> {
}
