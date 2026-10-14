package io.github.jackhudsonn.jaakd.config;

import java.util.List;
import java.util.Map;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.github.jackhudsonn.jaakd.dto.ErrorResponse;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.SessionService;

// Cookie-session security: the browser presents an opaque session cookie,
// never a token.
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http, SessionService sessionService,
                        ObjectMapper objectMapper,
            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                // No CSRF token: requests are authenticated by a SameSite=Lax
                // cookie, which browsers omit on cross-site state-changing calls.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/openapi.yaml", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/auth/register", "/api/auth/login").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

                            ErrorResponse payload = new ErrorResponse(
                                    Instant.now(),
                                    "Unauthorized",
                                    Map.of());

                            objectMapper.writeValue(response.getWriter(), payload);
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

                            ErrorResponse payload = new ErrorResponse(
                                    Instant.now(),
                                    "Forbidden",
                                    Map.of());

                            objectMapper.writeValue(response.getWriter(), payload);
                        }))
                .addFilterBefore(new SessionAuthenticationFilter(sessionService), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Allows the configured frontend origins to call this API with the session
    // cookie. Origins are configuration so deployments set their own.
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
