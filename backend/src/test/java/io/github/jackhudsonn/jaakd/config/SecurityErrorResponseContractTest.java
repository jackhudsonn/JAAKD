package io.github.jackhudsonn.jaakd.config;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.exception.GlobalExceptionHandler;
import io.github.jackhudsonn.jaakd.security.AuthenticatedUser;
import io.github.jackhudsonn.jaakd.security.SessionAuthenticationFilter;
import io.github.jackhudsonn.jaakd.service.SessionService;
import jakarta.servlet.http.Cookie;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = SecurityErrorResponseContractTest.SecurityContractTestController.class)
@Import({ SecurityConfig.class, GlobalExceptionHandler.class, SecurityErrorResponseContractTest.TestBeans.class })
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:4200")
class SecurityErrorResponseContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        UUID sessionId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID userId = UUID.fromString("22222222-2222-2222-2222-222222222222");

        when(sessionService.resolve(sessionId))
                .thenReturn(Optional.of(new AuthenticatedUser(userId, "tester@example.com")));
    }

    @Test
    void returnsErrorResponseJsonForUnauthorizedRequest() throws Exception {
        mockMvc.perform(get("/api/test/security/ok"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.message").value("Unauthorized"))
                .andExpect(jsonPath("$.details").isMap())
                .andExpect(jsonPath("$.details", Matchers.anEmptyMap()));
    }

    @Test
    void returnsErrorResponseJsonForForbiddenRequest() throws Exception {
        Cookie sessionCookie = new Cookie(
                SessionAuthenticationFilter.SESSION_COOKIE,
                "11111111-1111-1111-1111-111111111111");

        mockMvc.perform(get("/api/test/security/forbidden").cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.message").value("forbidden test"))
                .andExpect(jsonPath("$.details").value(Matchers.nullValue()));
    }

    @RestController
    @RequestMapping("/api/test/security")
    static class SecurityContractTestController {

        @GetMapping("/ok")
        public Map<String, String> ok() {
            return Map.of("status", "ok");
        }

        @GetMapping("/forbidden")
        public Map<String, String> forbidden() {
            throw new ForbiddenException("forbidden test");
        }
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        SecurityContractTestController securityContractTestController() {
            return new SecurityContractTestController();
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper().registerModule(new JavaTimeModule());
        }

        @Bean
        SessionService sessionService() {
            return mock(SessionService.class);
        }
    }
}
