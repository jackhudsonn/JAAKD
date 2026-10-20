package io.github.jackhudsonn.jaakd.identity.cognito;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Adapter-owned link between a Cognito subject and an application user. This
// table is absent when identity.provider is not cognito; using JdbcTemplate
// avoids Hibernate validating a table that should not exist in development.
@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "cognito")
public class CognitoUserStore {

    public record CognitoUser(
            UUID identityId,
            UUID userId,
            String subject,
            String email,
            String status,
            Instant createdAt,
            Instant expiresAt) {
    }

    private static final String SELECT_COLUMNS =
            "SELECT \"identityID\", \"userID\", subject, email, status, \"createdAt\", \"expiresAt\" ";

    private static final Duration PENDING_TTL = Duration.ofDays(7);

    private final JdbcTemplate jdbcTemplate;

    public CognitoUserStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<CognitoUser> findBySubject(String subject) {
        List<CognitoUser> rows = jdbcTemplate.query(
                SELECT_COLUMNS + "FROM cognito_users WHERE subject = ?",
                this::mapRow,
                subject);
        return rows.stream().findFirst();
    }

    public Optional<CognitoUser> findLatestByEmail(String email) {
        List<CognitoUser> rows = jdbcTemplate.query(
                SELECT_COLUMNS + "FROM cognito_users WHERE email = ? ORDER BY \"createdAt\" DESC LIMIT 1",
                this::mapRow,
                email);
        return rows.stream().findFirst();
    }

    public void insertPending(UUID userId, String subject, String email) {
        jdbcTemplate.update(
                """
                INSERT INTO cognito_users ("identityID", "userID", subject, email, status, "expiresAt")
                VALUES (?, ?, ?, ?, 'PENDING', ?)
                ON CONFLICT (subject) DO NOTHING
                """,
                UUID.randomUUID(), userId, subject, email, java.sql.Timestamp.from(Instant.now().plus(PENDING_TTL)));
    }

    public void markConfirmed(UUID identityId, String email) {
        jdbcTemplate.update(
                "UPDATE cognito_users SET status = 'CONFIRMED', email = ?, \"expiresAt\" = NULL WHERE \"identityID\" = ?",
                email, identityId);
    }

    public void markConfirmed(String subject, String email) {
        jdbcTemplate.update(
                "UPDATE cognito_users SET status = 'CONFIRMED', email = ?, \"expiresAt\" = NULL WHERE subject = ?",
                email, subject);
    }

    private CognitoUser mapRow(ResultSet rs, int rowNum) throws SQLException {
        java.sql.Timestamp expiresAt = rs.getTimestamp("expiresAt");
        return new CognitoUser(
                UUID.fromString(rs.getString("identityID")),
                UUID.fromString(rs.getString("userID")),
                rs.getString("subject"),
                rs.getString("email"),
                rs.getString("status"),
                rs.getTimestamp("createdAt").toInstant(),
                expiresAt == null ? null : expiresAt.toInstant());
    }
}
