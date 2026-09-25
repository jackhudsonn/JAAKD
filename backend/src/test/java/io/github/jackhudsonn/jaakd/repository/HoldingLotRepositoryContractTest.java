package io.github.jackhudsonn.jaakd.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HoldingLotRepositoryContractTest {

    @Test
    void positionLotOwnedQuery_containsOwnershipPredicate() throws Exception {
        Method method = PositionLotRepository.class.getMethod(
            "findOwnedByHoldingIdOldestFirst",
            UUID.class,
            UUID.class
        );

        Query query = method.getAnnotation(Query.class);
        assertNotNull(query);
        assertTrue(query.value().contains("p.profile.userId = :userId"));
    }

    @Test
    void lotMatchOwnedQuery_containsOwnershipPredicate() throws Exception {
        Method method = LotMatchRepository.class.getMethod(
            "findOwnedByHoldingIdOldestFirst",
            UUID.class,
            UUID.class
        );

        Query query = method.getAnnotation(Query.class);
        assertNotNull(query);
        assertTrue(query.value().contains("p.profile.userId = :userId"));
    }
}
