package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.ChatHistoryAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatHistoryAccessRepository extends JpaRepository<ChatHistoryAccess, String> {

    List<ChatHistoryAccess> findByAccessKeyStartingWith(String prefix);
}
