package io.github.jackhudsonn.jaakd.identity.cognito;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface CognitoUserRepository extends JpaRepository<CognitoUser, UUID> {

    Optional<CognitoUser> findBySubject(String subject);

    Optional<CognitoUser> findByUserId(UUID userId);

    @Query("""
            select c from CognitoUser c join c.user u
            where lower(u.email) = lower(:email) and c.status = :status
            order by c.createdAt desc
            """)
    List<CognitoUser> findByEmailAndStatus(
            @Param("email") String email,
            @Param("status") CognitoUserStatus status);

    @Modifying
    @Transactional
    @Query("""
            update CognitoUser c
            set c.status = :status, c.signUpSession = null, c.expiresAt = null
            where c.identityId = :identityId
            """)
    int markConfirmed(@Param("identityId") UUID identityId, @Param("status") CognitoUserStatus status);

    @Modifying
    @Transactional
    @Query("""
            update CognitoUser c
            set c.status = :status, c.signUpSession = null, c.expiresAt = null
            where c.subject = :subject
            """)
    int markConfirmedBySubject(@Param("subject") String subject, @Param("status") CognitoUserStatus status);
}
