package io.github.jackhudsonn.jaakd.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// Cognito adapter configuration. Bound only when identity.provider=cognito, so
// development runs do not need any Cognito values.
@Validated
@ConfigurationProperties(prefix = "identity.cognito")
public class CognitoProperties {

    @NotBlank
    private String region;

    @NotBlank
    private String userPoolId;

    @NotBlank
    private String clientId;

    @NotBlank
    private String clientSecret;

    private Duration apiCallTimeout = Duration.ofSeconds(10);
    private Duration apiCallAttemptTimeout = Duration.ofSeconds(5);

    @Min(0)
    private int retryAttempts = 2;

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getUserPoolId() {
        return userPoolId;
    }

    public void setUserPoolId(String userPoolId) {
        this.userPoolId = userPoolId;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public Duration getApiCallTimeout() {
        return apiCallTimeout;
    }

    public void setApiCallTimeout(Duration apiCallTimeout) {
        this.apiCallTimeout = apiCallTimeout;
    }

    public Duration getApiCallAttemptTimeout() {
        return apiCallAttemptTimeout;
    }

    public void setApiCallAttemptTimeout(Duration apiCallAttemptTimeout) {
        this.apiCallAttemptTimeout = apiCallAttemptTimeout;
    }

    public int getRetryAttempts() {
        return retryAttempts;
    }

    public void setRetryAttempts(int retryAttempts) {
        this.retryAttempts = retryAttempts;
    }

    public String issuer() {
        return "https://cognito-idp." + region + ".amazonaws.com/" + userPoolId;
    }

    public String jwkSetUri() {
        return issuer() + "/.well-known/jwks.json";
    }
}
