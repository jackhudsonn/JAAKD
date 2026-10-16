package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.User;
import io.github.jackhudsonn.jaakd.repository.projection.AuditUserSearchProjection;

import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

	@Query("""
		SELECT
			u.userId AS userId,
			u.email AS email,
			p.username AS username,
			p.firstName AS firstName,
			p.lastName AS lastName
		FROM User u
		LEFT JOIN Profile p ON p.userId = u.userId
		WHERE UPPER(u.email) LIKE UPPER(CONCAT('%', :query, '%'))
		   OR UPPER(COALESCE(p.username, '')) LIKE UPPER(CONCAT('%', :query, '%'))
		   OR UPPER(COALESCE(p.firstName, '')) LIKE UPPER(CONCAT('%', :query, '%'))
		   OR UPPER(COALESCE(p.lastName, '')) LIKE UPPER(CONCAT('%', :query, '%'))
		ORDER BY u.userId ASC
		""")
	Page<AuditUserSearchProjection> findByAuditSearchQuery(
		@Param("query") String query,
		Pageable pageable
	);
}
