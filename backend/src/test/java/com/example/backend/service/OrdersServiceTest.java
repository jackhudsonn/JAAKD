package com.example.backend.service;

import com.example.backend.dto.PlaceOrderRequest;
import com.example.backend.model.Holding;
import com.example.backend.model.Instrument;
import com.example.backend.model.Portfolio;
import com.example.backend.model.TradeOrder;
import com.example.backend.repository.HoldingRepository;
import com.example.backend.repository.InstrumentRepository;
import com.example.backend.repository.OrderLogRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.repository.TradeOrderRepository;
import com.example.backend.security.CurrentUserService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// See src/test/java/com/example/backend/service/README.md for how to run these tests.
@ExtendWith(MockitoExtension.class)
class OrdersServiceTest {

    @Mock
    private TradeOrderRepository tradeOrderRepository;
    @Mock
    private OrderLogRepository orderLogRepository;
    @Mock
    private PortfolioRepository portfolioRepository;
    @Mock
    private InstrumentRepository instrumentRepository;
    @Mock
    private HoldingRepository holdingRepository;
    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private OrdersService ordersService;

    private UUID userId;
    private UUID portfolioId;
    private UUID instrumentId;
    private UUID orderId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        portfolioId = UUID.randomUUID();
        instrumentId = UUID.randomUUID();
        orderId = UUID.randomUUID();
    }

    private PlaceOrderRequest buildOrderRequest(UUID portfolioId, UUID instrumentId, long quantity, double price, String side) {
        return new PlaceOrderRequest(portfolioId, instrumentId, quantity, price, side);
    }

    // ==================== ping ====================

    @Test
    void ping_returnsExpectedMessage() {
        assertThat(ordersService.ping()).isEqualTo("ok - orders service");
    }

    // ==================== placeOrder ====================

    @Test
    void placeOrder_buyWithSufficientCash_savesOrderAndLogsPlaced() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));
        when(tradeOrderRepository.save(any(TradeOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = ordersService.placeOrder(buildOrderRequest(portfolioId, instrumentId, 10, 5.0, "buy"));

        assertThat(result).startsWith("Order placed:");
        verify(orderLogRepository).save(any());
    }

    @Test
    void placeOrder_portfolioBelongsToDifferentUser_throws() {
        Portfolio portfolio = new Portfolio(UUID.randomUUID());
        portfolio.setCashHoldings(1000.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> ordersService.placeOrder(buildOrderRequest(portfolioId, instrumentId, 10, 5.0, "buy")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");
    }

    @Test
    void placeOrder_buyWithInsufficientCash_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(10.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));

        assertThatThrownBy(() -> ordersService.placeOrder(buildOrderRequest(portfolioId, instrumentId, 10, 5.0, "buy")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient cash");
    }

    @Test
    void placeOrder_sellWithInsufficientQuantity_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);
        Holding holding = new Holding(portfolioId, instrumentId);
        holding.setQuantity(2L);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));
        when(holdingRepository.findByPortfolioIdAndInstrumentId(portfolioId, instrumentId))
                .thenReturn(Optional.of(holding));

        assertThatThrownBy(() -> ordersService.placeOrder(buildOrderRequest(portfolioId, instrumentId, 10, 5.0, "sell")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient stock quantity");
    }

    @Test
    void placeOrder_invalidSide_throws() {
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));

        assertThatThrownBy(() -> ordersService.placeOrder(buildOrderRequest(portfolioId, instrumentId, 10, 5.0, "hold")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Side must be");
    }

    // ==================== acceptOrder ====================

    @Test
    void acceptOrder_buyWithSufficientCash_reservesUpTo110Percent() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("buy");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));

        String result = ordersService.acceptOrder(orderId);

        assertThat(result).isEqualTo("Order accepted: " + orderId);
        // 10 * 5.0 * 1.10 = 55.0 reserved from 1000.0
        assertThat(portfolio.getCashHoldings()).isEqualTo(945.0);
        verify(orderLogRepository).save(any());
    }

    @Test
    void acceptOrder_buyWithInsufficientCashAtAcceptance_throws() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("buy");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1.0);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));

        assertThatThrownBy(() -> ordersService.acceptOrder(orderId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient cash at acceptance time");
    }

    @Test
    void acceptOrder_sellWithNoHolding_throws() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("sell");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(new Instrument("stock")));
        when(holdingRepository.findByPortfolioIdAndInstrumentId(portfolioId, instrumentId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> ordersService.acceptOrder(orderId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No holding available");
    }

    // ==================== executeOrder ====================

    @Test
    void executeOrder_buyWithinLimitAndCash_updatesPortfolioAndHolding() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("buy");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(holdingRepository.findByPortfolioIdAndInstrumentId(portfolioId, instrumentId))
                .thenReturn(Optional.empty());

        String result = ordersService.executeOrder(orderId, 5.0);

        assertThat(result).isEqualTo("Order executed: " + orderId);
        assertThat(portfolio.getCashHoldings()).isEqualTo(950.0);
        verify(holdingRepository).save(any(Holding.class));
        verify(orderLogRepository).save(any());
    }

    @Test
    void executeOrder_buyExceeding110PercentLimit_throws() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("buy");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(1000.0);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        // 10 * 6.0 = 60.0 exceeds 10 * 5.0 * 1.10 = 55.0
        assertThatThrownBy(() -> ordersService.executeOrder(orderId, 6.0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds 110% limit");
    }

    @Test
    void executeOrder_sellUpdatesHoldingAndCash() {
        TradeOrder order = new TradeOrder(portfolioId, 10L, 5.0);
        order.setSide("sell");
        order.setInstrumentId(instrumentId);
        Portfolio portfolio = new Portfolio(userId);
        portfolio.setCashHoldings(0.0);
        Holding holding = new Holding(portfolioId, instrumentId);
        holding.setQuantity(20L);
        holding.setCost(100.0);

        when(tradeOrderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(holdingRepository.findByPortfolioIdAndInstrumentId(portfolioId, instrumentId))
                .thenReturn(Optional.of(holding));

        String result = ordersService.executeOrder(orderId, 6.0);

        assertThat(result).isEqualTo("Order executed: " + orderId);
        assertThat(holding.getQuantity()).isEqualTo(10L);
        assertThat(holding.getCost()).isEqualTo(50.0);
        assertThat(portfolio.getCashHoldings()).isEqualTo(60.0);
    }
}
