package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.ChatLogEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatLogRepository extends JpaRepository<ChatLogEntry, Long> {

    List<ChatLogEntry> findByPersonKeyOrderByCreatedAtAsc(String personKey);

    /** Newest first, for the AI's recall of earlier chats */
    List<ChatLogEntry> findByPersonKeyAndCreatedAtBeforeOrderByCreatedAtDesc(String personKey, LocalDateTime before, Pageable page);

    List<ChatLogEntry> findByCreatedAtAfter(LocalDateTime since);

    /** One row per person: key, role, number of questions, last activity (newest first) */
    @Query("SELECT c.personKey, c.role, SUM(CASE WHEN c.sender = 'USER' THEN 1 ELSE 0 END), MAX(c.createdAt) "
            + "FROM ChatLogEntry c GROUP BY c.personKey, c.role ORDER BY MAX(c.createdAt) DESC")
    List<Object[]> summarizePeople();
}
