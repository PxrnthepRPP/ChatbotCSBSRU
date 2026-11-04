package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.FaqEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FaqEntryRepository extends JpaRepository<FaqEntry, Long> {

    List<FaqEntry> findAllByOrderByCategoryAscIdAsc();

    List<FaqEntry> findByActiveTrue();
}
