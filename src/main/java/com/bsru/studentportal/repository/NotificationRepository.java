package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop30ByRecipientUsernameInOrderByCreatedAtDesc(Collection<String> usernames);

    List<Notification> findTop30ByRecipientUsernameOrderByCreatedAtDesc(String recipientUsername);

    long countByRecipientUsernameInAndIsReadFalse(Collection<String> usernames);

    long countByRecipientUsernameAndIsReadFalse(String recipientUsername);

    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.recipientUsername IN :recipientUsernames AND n.isRead = false")
    int markAllAsReadByRecipientUsernames(@Param("recipientUsernames") Collection<String> recipientUsernames);
}
