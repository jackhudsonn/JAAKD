package io.github.jackhudsonn.jaakd.identity.cognito;

import java.util.Collection;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import io.github.jackhudsonn.jaakd.config.CognitoProperties;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;

// Verifies a Cognito ID token locally. Nimbus validates the signature, expiry,
// and issuer from the pool's JWKS; the remaining claims are checked here.
@Component
@ConditionalOnProperty(name = "identity.provider", havingValue = "cognito")
public class CognitoIdTokenVerifier {

    private static final String TOKEN_USE = "token_use";
    private static final String ID_TOKEN_USE = "id";
    private static final String EMAIL_VERIFIED = "email_verified";

    public record CognitoIdentity(String subject, String email) {
    }

    private final JwtDecoder jwtDecoder;
    private final CognitoProperties properties;

    public CognitoIdTokenVerifier(JwtDecoder cognitoJwtDecoder, CognitoProperties properties) {
        this.jwtDecoder = cognitoJwtDecoder;
        this.properties = properties;
    }

    public CognitoIdentity verify(String idToken) {
        ParsedClaims claims = parse(idToken);
        validate(claims);
        return new CognitoIdentity(claims.subject(), claims.email());
    }

    private ParsedClaims parse(String idToken) {
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(idToken);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new UnauthorizedException("invalid identity token");
        }

        return new ParsedClaims(
                jwt.getClaimAsString(TOKEN_USE),
                parseAudience(jwt.getClaims().get("aud")),
                jwt.getSubject(),
                jwt.getClaimAsString("email"),
                parseEmailVerified(jwt.getClaims().get(EMAIL_VERIFIED)));
    }

    private void validate(ParsedClaims claims) {
        if (!ID_TOKEN_USE.equals(claims.tokenUse())
                || !claims.audiences().contains(properties.getClientId())
                || isBlank(claims.subject())
                || isBlank(claims.email())) {
            throw new UnauthorizedException("invalid identity token");
        }

        if (!claims.emailVerified()) {
            throw new UnauthorizedException("email address is not verified");
        }
    }

    private List<String> parseAudience(Object audience) {
        if (audience instanceof String value) {
            return List.of(value);
        }
        if (audience instanceof Collection<?> values) {
            return values.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .toList();
        }
        return List.of();
    }

    private boolean parseEmailVerified(Object emailVerified) {
        if (emailVerified instanceof Boolean value) {
            return value;
        }
        return "true".equalsIgnoreCase(String.valueOf(emailVerified));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record ParsedClaims(
            String tokenUse,
            List<String> audiences,
            String subject,
            String email,
            boolean emailVerified) {

        private ParsedClaims {
            email = email == null ? null : email.trim().toLowerCase();
        }
    }
}
