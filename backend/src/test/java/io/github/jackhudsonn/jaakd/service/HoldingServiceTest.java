package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HoldingServiceTest {

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PositionLotRepository positionLotRepository;

    @Mock
    private LotMatchRepository lotMatchRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private HoldingService holdingService;

    @Test
    void getPositionLotsForHolding_mapsRowsForOwnedHolding() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();
        UUID buyLogId = UUID.randomUUID();

        Holding holding = new Holding(portfolioId, instrumentId);
        setField(holding, "holdingID", holdingId);

        PositionLot lot = new PositionLot(
            holdingId,
            buyLogId,
            ZonedDateTime.parse("2026-09-25T10:00:00Z"),
            new BigDecimal("10.00"),
            new BigDecimal("6.00"),
            new BigDecimal("100.25")
        );
        setField(lot, "positionLotID", UUID.randomUUID());

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.of(holding));
        when(positionLotRepository.findOwnedByHoldingIdOldestFirst(holdingId, userId)).thenReturn(List.of(lot));

        List<PositionLotResponse> result = holdingService.getPositionLotsForHolding(holdingId);

        assertEquals(1, result.size());
        assertEquals(lot.getPositionLotID(), result.get(0).positionLotId());
        assertEquals(new BigDecimal("10.00"), result.get(0).originalQuantity());
        assertEquals(new BigDecimal("6.00"), result.get(0).remainingQuantity());
        assertEquals(new BigDecimal("100.25"), result.get(0).unitCost());
    }

    @Test
    void getLotMatchesForHolding_ownedHoldingNoRows_returnsEmptyList() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();
        UUID portfolioId = UUID.randomUUID();
        UUID instrumentId = UUID.randomUUID();

        Holding holding = new Holding(portfolioId, instrumentId);
        setField(holding, "holdingID", holdingId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.of(holding));
        when(lotMatchRepository.findOwnedByHoldingIdOldestFirst(holdingId, userId)).thenReturn(List.of());

        List<LotMatchResponse> result = holdingService.getLotMatchesForHolding(holdingId);

        assertEquals(0, result.size());
    }

    @Test
    void getLotMatchesForHolding_unownedHolding_throwsNotFoundAndSkipsLotQuery() {
        UUID userId = UUID.randomUUID();
        UUID holdingId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(holdingRepository.findOwnedByHoldingId(holdingId, userId)).thenReturn(Optional.empty());

        assertThrows(HoldingNotFoundException.class, () -> holdingService.getLotMatchesForHolding(holdingId));

        verify(lotMatchRepository, never()).findOwnedByHoldingIdOldestFirst(holdingId, userId);
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
