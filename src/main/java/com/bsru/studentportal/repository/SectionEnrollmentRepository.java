package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SectionEnrollmentRepository extends JpaRepository<SectionEnrollment, Long> {
    List<SectionEnrollment> findByStudentStudentId(String studentId);

    List<SectionEnrollment> findBySectionId(Long sectionId);

    Optional<SectionEnrollment> findByStudentStudentIdAndSectionId(String studentId, Long sectionId);

    long countBySectionId(Long sectionId);

    long countBySectionIdAndStatusIn(Long sectionId, Collection<EnrollmentStatus> statuses);

    List<SectionEnrollment> findBySectionIdAndStatusIn(Long sectionId, Collection<EnrollmentStatus> statuses);

    List<SectionEnrollment> findByStatusOrderByEnrolledAtAsc(EnrollmentStatus status);

    void deleteBySectionId(Long sectionId);
}
