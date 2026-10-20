package io.github.jackhudsonn.jaakd.identity.cognito;

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

    public record CognitoIdentity(String subject, String email) {
    }

    private final JwtDecoder jwtDecoder;
    private final CognitoProperties properties;

    public CognitoIdTokenVerifier(JwtDecoder cognitoJwtDecoder, CognitoProperties properties) {
        this.jwtDecoder = cognitoJwtDecoder;
        this.properties = properties;
    }

    public CognitoIdentity verify(String idToken) {
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(idToken);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new UnauthorizedException("invalid identity token");
        }

        if (!"id".equals(jwt.getClaimAsString("token_use"))) {
            throw new UnauthorizedException("invalid identity token");
        }

        Object audience = jwt.getClaims().get("aud");
        boolean audienceMatches = audience instanceof String value
                ? properties.getClientId().equals(value)
                : audience instanceof java.util.Collection<?> values
                        && values.contains(properties.getClientId());
        if (!audienceMatches) {
            throw new UnauthorizedException("invalid identity token");
        }

        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        if (subject == null || subject.isBlank() || email == null || email.isBlank()) {
            throw new UnauthorizedException("invalid identity token");
        }

        Object emailVerified = jwt.getClaims().get("email_verified");
        if (!Boolean.TRUE.equals(emailVerified) && !"true".equalsIgnoreCase(String.valueOf(emailVerified))) {
            throw new UnauthorizedException("email address is not verified");
        }

        return new CognitoIdentity(subject, email.trim().toLowerCase());
    }
}
