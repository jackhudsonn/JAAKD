package io.github.jackhudsonn.jaakd.identity.cognito;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import io.github.jackhudsonn.jaakd.exception.IdentityProviderUnavailableException;

// Cognito's SECRET_HASH: Base64(HMAC-SHA256(clientSecret, username + clientId)).
// Required on unauthenticated app-client calls when the client has a secret.
public final class SecretHash {

    private static final String ALGORITHM = "HmacSHA256";

    private SecretHash() {
    }

    public static String calculate(String clientSecret, String clientId, String username) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(clientSecret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            byte[] digest = mac.doFinal((username + clientId).getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception ex) {
            throw new IdentityProviderUnavailableException("unable to compute Cognito secret hash", ex);
        }
    }
}
