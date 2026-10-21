package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.BackendApplication;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(classes = BackendApplication.class)
@ActiveProfiles("test")
@Transactional
class UserProvisionerPersistenceIntegrationTest {

    @Autowired
    private UserProvisioner userProvisioner;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void ensureUser_flushesTheInsertBeforeJdbcReads() {
        UUID userId = UUID.randomUUID();

        userProvisioner.ensureUser(userId, "flush-test@example.com");

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM \"users\" WHERE \"userID\" = ?", Integer.class, userId);
        assertEquals(1, count);
    }
}
