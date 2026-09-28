package io.github.jackhudsonn.jaakd.repository;

import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class OrderLogRepositoryContractTest {

    @Test
    void findOwnedByLogOrderIdForUpdate_usesPessimisticWriteLock() throws Exception {
        Method method = OrderLogRepository.class.getMethod(
            "findOwnedByLogOrderIdForUpdate",
            java.util.UUID.class,
            java.util.UUID.class
        );

        Lock lock = method.getAnnotation(Lock.class);
        assertNotNull(lock);
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lock.value());
    }
}
