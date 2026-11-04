package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.ChatHistoryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ChatHistoryRepository extends JpaRepository<ChatHistoryEntry, Long> {

    List<ChatHistoryEntry> findBySessionIdOrderByTimestampAsc(String sessionId);

    List<ChatHistoryEntry> findByUserKeyOrderByTimestampAsc(String userKey);

    @Query("SELECT c FROM ChatHistoryEntry c WHERE c.sessionId = :key OR c.userKey = :key ORDER BY c.timestamp ASC")
    List<ChatHistoryEntry> findBySessionIdOrUserKeyOrderByTimestampAsc(@Param("key") String key);

    @Transactional
    @Modifying
    @Query("DELETE FROM ChatHistoryEntry c WHERE c.sessionId = :sessionId")
    int deleteBySessionId(@Param("sessionId") String sessionId);

    @Transactional
    @Modifying
    @Query("DELETE FROM ChatHistoryEntry c WHERE c.userKey = :userKey")
    int deleteByUserKey(@Param("userKey") String userKey);

    @Transactional
    @Modifying
    @Query("DELETE FROM ChatHistoryEntry c WHERE c.sessionId = :key OR c.userKey = :key")
    int deleteBySessionIdOrUserKey(@Param("key") String key);
}
