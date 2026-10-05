package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.RegistrationPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RegistrationPeriodRepository extends JpaRepository<RegistrationPeriod, Long> {
    Optional<RegistrationPeriod> findByAcademicYearAndTerm(Integer academicYear, Integer term);

    List<RegistrationPeriod> findAllByOrderByAcademicYearDescTermDesc();
}
