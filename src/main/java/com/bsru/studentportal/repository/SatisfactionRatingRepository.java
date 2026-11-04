package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.SatisfactionRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SatisfactionRatingRepository extends JpaRepository<SatisfactionRating, Long> {

    List<SatisfactionRating> findByCreatedAtAfter(LocalDateTime since);
}
