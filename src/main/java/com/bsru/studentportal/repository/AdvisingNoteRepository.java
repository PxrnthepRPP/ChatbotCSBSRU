package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.AdvisingNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdvisingNoteRepository extends JpaRepository<AdvisingNote, Long> {

    List<AdvisingNote> findByStudentIdOrderByCreatedAtDesc(String studentId);

    List<AdvisingNote> findByAdvisorIdOrderByCreatedAtDesc(String advisorId);

    Optional<AdvisingNote> findByIdAndAdvisorId(Long id, String advisorId);

    Optional<AdvisingNote> findByIdAndStudentId(Long id, String studentId);

    void deleteByStudentId(String studentId);

    long deleteByIdAndAdvisorId(Long id, String advisorId);
}
