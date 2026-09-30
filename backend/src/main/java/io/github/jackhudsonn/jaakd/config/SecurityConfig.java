package io.github.jackhudsonn.jaakd.config;

import java.util.List;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;

// Stateless resource server: every request must carry a valid HS256 JWT signed with the shared secret.
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(jwtDecoder)));

        return http.build();
    }

    // Verifies access tokens issued by auth-service.
    // Known trade-off: HS256 is symmetric, so this service holds the same
    // JWT_SECRET that
    // auth-service signs with. Anyone who obtains it (from either service) can mint
    // a valid
    // token for any user. Mitigations today: the secret lives only in env vars /
    // Jenkins
    // credentials, the algorithm is pinned to HS256, and tokens expire after 15
    // minutes.
    // Planned follow-up: RS256 with a JWKS endpoint on auth-service, so the backend
    // only holds
    // public keys (see prototypes/Kyle/docs/04-jwt-signing-key-notes.md).
    @Bean
    public JwtDecoder jwtDecoder(@Value("${jwt.shared-secret}") String sharedSecret) {
        SecretKeySpec key = new SecretKeySpec(sharedSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(accessTokenValidator());
        return decoder;
    }

    // Expiry plus the claims the backend relies on. A token without a
    // subject or email is rejected here with 401.
    static OAuth2TokenValidator<Jwt> accessTokenValidator() {
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, SecurityConfig::hasText),
                new JwtClaimValidator<String>(CurrentUserService.EMAIL_CLAIM, SecurityConfig::hasText));
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    // Allows the Angular dev server (and other configured origins) to call this API
    // with the Authorization header.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:4200", "http://10.23.135.30:8082"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
