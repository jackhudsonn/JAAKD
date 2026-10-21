package io.github.jackhudsonn.jaakd.identity.development;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;

// Development adapter backed by the development_credentials table. The table
// exists in every environment so provider switches need no migration; only this
// adapter reads it. It verifies credentials and returns an identity; it issues
// no tokens, because the application owns sessions.
@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "development")
public class DevelopmentIdentityProvider implements IdentityProvider {

    private static final String SELECT_BY_EMAIL =
            "SELECT \"userID\", \"passwordHash\" FROM development_credentials WHERE email = ?";

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public DevelopmentIdentityProvider(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public RegistrationOutcome register(UUID userId, String email, String password) {
        String normalized = normalize(email);

        if (!jdbcTemplate.queryForList("SELECT 1 FROM development_credentials WHERE email = ?", normalized).isEmpty()) {
            throw new ConflictException("email already registered");
        }

        jdbcTemplate.update(
                "INSERT INTO development_credentials (\"userID\", email, \"passwordHash\") VALUES (?, ?, ?)",
                userId, normalized, passwordEncoder.encode(password));

        return new RegistrationOutcome(userId.toString(), false, null);
    }

    @Override
    public void link(UUID userId, String subject, String email, String signUpSession) {
        // The credential row already carries the application userID.
    }

    @Override
    public Optional<SignInOutcome.Authenticated> confirmRegistration(String email, String code) {
        // No email confirmation step in development.
        return Optional.empty();
    }

    @Override
    public void resendConfirmation(String email) {
        // No email confirmation step in development.
    }

    @Override
    public SignInOutcome signIn(String email, String password) {
        Map<String, Object> credential = findCredential(email);

        if (credential == null || !passwordEncoder.matches(password, (String) credential.get("passwordHash"))) {
            throw new UnauthorizedException("invalid email or password");
        }

        return new SignInOutcome.Authenticated((UUID) credential.get("userID"), normalize(email), null);
    }

    @Override
    public void changePassword(String email, String currentPassword, String newPassword) {
        Map<String, Object> credential = findCredential(email);

        if (credential == null || !passwordEncoder.matches(currentPassword, (String) credential.get("passwordHash"))) {
            throw new UnauthorizedException("invalid email or password");
        }

        jdbcTemplate.update(
                "UPDATE development_credentials SET \"passwordHash\" = ? WHERE email = ?",
                passwordEncoder.encode(newPassword), normalize(email));
    }

    @Override
    public void revoke(String refreshToken) {
        // The development provider issues no provider-side session.
    }

    private Map<String, Object> findCredential(String email) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(SELECT_BY_EMAIL, normalize(email));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
