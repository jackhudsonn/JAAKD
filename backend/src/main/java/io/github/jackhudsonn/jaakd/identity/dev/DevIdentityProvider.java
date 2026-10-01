package io.github.jackhudsonn.jaakd.identity.dev;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;

// Development adapter backed by the dev-only dev_credentials table. It verifies
// credentials and returns an identity; it issues no tokens, because the
// application owns sessions.
@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "dev", matchIfMissing = true)
public class DevIdentityProvider implements IdentityProvider {

    private static final String SELECT_BY_EMAIL =
            "SELECT \"userID\", \"passwordHash\" FROM dev_credentials WHERE email = ?";

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public DevIdentityProvider(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void register(String email, String password) {
        String normalized = normalize(email);

        if (!jdbcTemplate.queryForList("SELECT 1 FROM dev_credentials WHERE email = ?", normalized).isEmpty()) {
            throw new ConflictException("email already registered");
        }

        jdbcTemplate.update(
                "INSERT INTO dev_credentials (\"userID\", email, \"passwordHash\") VALUES (?, ?, ?)",
                UUID.randomUUID(), normalized, passwordEncoder.encode(password));
    }

    @Override
    public SignInOutcome signIn(String email, String password) {
        Map<String, Object> credential = findCredential(email);

        if (credential == null || !passwordEncoder.matches(password, (String) credential.get("passwordHash"))) {
            throw new UnauthorizedException("invalid email or password");
        }

        return new SignInOutcome.Authenticated((UUID) credential.get("userID"), normalize(email));
    }

    @Override
    public void changePassword(String email, String currentPassword, String newPassword) {
        Map<String, Object> credential = findCredential(email);

        if (credential == null || !passwordEncoder.matches(currentPassword, (String) credential.get("passwordHash"))) {
            throw new UnauthorizedException("invalid email or password");
        }

        jdbcTemplate.update(
                "UPDATE dev_credentials SET \"passwordHash\" = ? WHERE email = ?",
                passwordEncoder.encode(newPassword), normalize(email));
    }

    @Override
    public void signOut(String email) {
        // The backend owns the session; there is no provider-side session to clear.
    }

    private Map<String, Object> findCredential(String email) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(SELECT_BY_EMAIL, normalize(email));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
