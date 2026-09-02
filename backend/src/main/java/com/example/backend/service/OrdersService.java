package com.example.backend.service;

import org.springframework.stereotype.Service;
import com.example.backend.model.TradeOrder;
import com.example.backend.model.OrderLog;
import com.example.backend.model.Portfolio;
import com.example.backend.model.Instrument;
import com.example.backend.repository.TradeOrderRepository;
import com.example.backend.repository.OrderLogRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.repository.InstrumentRepository;
import com.example.backend.repository.HoldingRepository;
import com.example.backend.security.CurrentUserService;
import com.example.backend.model.Holding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

@Service
public class OrdersService {

    private final TradeOrderRepository tradeOrderRepository;
    private final OrderLogRepository orderLogRepository;
    private final PortfolioRepository portfolioRepository;
    private final InstrumentRepository instrumentRepository;
    private final HoldingRepository holdingRepository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OrdersService(
            TradeOrderRepository tradeOrderRepository,
            OrderLogRepository orderLogRepository,
            PortfolioRepository portfolioRepository,
            InstrumentRepository instrumentRepository,
            HoldingRepository holdingRepository,
            CurrentUserService currentUserService) {
        this.tradeOrderRepository = tradeOrderRepository;
        this.orderLogRepository = orderLogRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.holdingRepository = holdingRepository;
        this.currentUserService = currentUserService;
    }

    // ==================== STEP 1: PLACE ====================
    public String placeOrder(String order) {
        // 1. Extract current user
        UUID userId = currentUserService.getUserId();
        
        // 2. Validate portfolio ownership
        UUID portfolioId = extractPortfolioId(order);
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        if (!portfolio.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Portfolio does not belong to current user");
        }
        
        // 3. Validate instrument exists
        UUID instrumentId = extractInstrumentId(order);
        instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found"));
        
        // 4. Parse order details
        Long quantity = extractQuantity(order);
        Double initPrice = extractPrice(order);
        String side = extractSide(order);
        
        // 5. Validate order parameters
        if (quantity <= 0) throw new IllegalArgumentException("Quantity must be positive");
        if (initPrice <= 0) throw new IllegalArgumentException("Price must be positive");
        if (!side.equalsIgnoreCase("buy") && !side.equalsIgnoreCase("sell")) {
            throw new IllegalArgumentException("Side must be 'buy' or 'sell'");
        }
        
        // 6. For BUY: check sufficient cash available
        if (side.equalsIgnoreCase("buy")) {
            Double totalCost = quantity * initPrice;
            if (portfolio.getCashHoldings() < totalCost) {
                throw new IllegalArgumentException("Insufficient cash");
            }
        }
        
        // 7. For SELL: check sufficient stock quantity
        if (side.equalsIgnoreCase("sell")) {
            Holding holding = holdingRepository.findByPortfolioIdAndInstrumentId(portfolioId, instrumentId)
                    .orElseThrow(() -> new IllegalArgumentException("No holding for this instrument"));
            if (holding.getQuantity() < quantity) {
                throw new IllegalArgumentException("Insufficient stock quantity");
            }
        }
        
        // 8. Create TradeOrder
        TradeOrder tradeOrder = new TradeOrder(portfolioId, quantity, initPrice);
        tradeOrder.setSide(side);
        tradeOrder.setInstrumentId(instrumentId);
        TradeOrder savedOrder = tradeOrderRepository.save(tradeOrder);
        
        // 9. Create OrderLog with "Placed"
        OrderLog orderLog = new OrderLog(savedOrder.getOrderId());
        orderLog.setStatus("Placed");
        orderLogRepository.save(orderLog);
        
        return "Order placed: " + savedOrder.getOrderId();
    }

    // ==================== STEP 2: ACCEPT ====================
    public String acceptOrder(UUID orderId) {
        // 1. Find existing TradeOrder
        TradeOrder order = tradeOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        
        Portfolio portfolio = portfolioRepository.findById(order.getPortfolioId())
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        
        Instrument instrument = instrumentRepository.findById(order.getInstrumentId())
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found"));
        
        // 2. Check market is open for instrument
        if (!isMarketOpen(instrument)) {
            throw new IllegalArgumentException("Market is closed for this instrument");
        }
        
        // 3. For BUY orders
        if (order.getSide().equalsIgnoreCase("buy")) {
            // Recheck current cash holdings
            Double totalCost = order.getQuantity() * order.getInitPrice();
            if (portfolio.getCashHoldings() < totalCost) {
                throw new IllegalArgumentException("Insufficient cash at acceptance time");
            }
            
            // Reserve up to 110% of order price
            Double reserveAmount = totalCost * 1.10;
            Double actualReserve = Math.min(reserveAmount, portfolio.getCashHoldings());
            
            // Deduct reserved amount
            portfolio.setCashHoldings(portfolio.getCashHoldings() - actualReserve);
            portfolioRepository.save(portfolio);
        }
        
        // 4. For SELL orders
        if (order.getSide().equalsIgnoreCase("sell")) {
            // Recheck stock quantity
            Holding holding = holdingRepository.findByPortfolioIdAndInstrumentId(
                    order.getPortfolioId(), order.getInstrumentId())
                    .orElseThrow(() -> new IllegalArgumentException("No holding available"));
            
            if (holding.getQuantity() < order.getQuantity()) {
                throw new IllegalArgumentException("Insufficient stock at acceptance time");
            }
        }
        
        // 5. Create OrderLog with "Accepted"
        OrderLog acceptLog = new OrderLog(orderId);
        acceptLog.setStatus("Accepted");
        orderLogRepository.save(acceptLog);
        
        return "Order accepted: " + orderId;
    }

    // ==================== STEP 3: EXECUTE ====================
    public String executeOrder(UUID orderId, Double executionPrice) {
        // 1. Find existing TradeOrder
        TradeOrder order = tradeOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        
        Portfolio portfolio = portfolioRepository.findById(order.getPortfolioId())
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        
        // 2. For BUY orders
        if (order.getSide().equalsIgnoreCase("buy")) {
            Double totalExecutionCost = order.getQuantity() * executionPrice;
            Double maxLimit = order.getQuantity() * order.getInitPrice() * 1.10;
            
            // Guarantee execution price is within 110% limit
            if (totalExecutionCost > maxLimit) {
                throw new IllegalArgumentException("Execution cost exceeds 110% limit");
            }
            
            // Guarantee execution price <= available cash
            if (totalExecutionCost > portfolio.getCashHoldings()) {
                throw new IllegalArgumentException("Insufficient cash for execution");
            }
            
            // Deduct final execution cost
            portfolio.setCashHoldings(portfolio.getCashHoldings() - totalExecutionCost);
            portfolioRepository.save(portfolio);
            
            // Create or update Holding
            Holding holding = holdingRepository.findByPortfolioIdAndInstrumentId(
                    order.getPortfolioId(), order.getInstrumentId())
                    .orElse(new Holding(order.getPortfolioId(), order.getInstrumentId()));
            
            // Update cost basis and quantity
            Double executionCost = order.getQuantity() * executionPrice;
            holding.setCost(holding.getCost() + executionCost);
            holding.setQuantity(holding.getQuantity() + order.getQuantity());
            holdingRepository.save(holding);
        }
        
        // 3. For SELL orders
        if (order.getSide().equalsIgnoreCase("sell")) {
            Holding holding = holdingRepository.findByPortfolioIdAndInstrumentId(
                    order.getPortfolioId(), order.getInstrumentId())
                    .orElseThrow(() -> new IllegalArgumentException("No holding to sell"));
            
            // Calculate average cost per share and reduce cost basis proportionally
            Double avgCostPerShare = holding.getCost() / holding.getQuantity();
            Double costOfSoldShares = order.getQuantity() * avgCostPerShare;
            
            // Deduct stock from holding and update cost basis
            holding.setQuantity(holding.getQuantity() - order.getQuantity());
            holding.setCost(holding.getCost() - costOfSoldShares);
            holdingRepository.save(holding);
            
            // Add cash to portfolio
            Double totalProceeds = order.getQuantity() * executionPrice;
            portfolio.setCashHoldings(portfolio.getCashHoldings() + totalProceeds);
            portfolioRepository.save(portfolio);
        }
        
        // 4. Create OrderLog with "Executed"
        OrderLog execLog = new OrderLog(orderId);
        execLog.setStatus("Executed");
        execLog.setExecutePrice(executionPrice);
        orderLogRepository.save(execLog);
        
        return "Order executed: " + orderId;
    }

    // ==================== HELPER METHODS ====================
    private boolean isMarketOpen(Instrument instrument) {
        // TODO: Implement market hours check for instrument
        return true;
    }

    private UUID extractPortfolioId(String order) {
        try {
            JsonNode node = objectMapper.readTree(order);
            return UUID.fromString(node.get("portfolioId").asText());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid portfolioId: " + e.getMessage());
        }
    }

    private UUID extractInstrumentId(String order) {
        try {
            JsonNode node = objectMapper.readTree(order);
            return UUID.fromString(node.get("instrumentId").asText());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid instrumentId: " + e.getMessage());
        }
    }

    private Long extractQuantity(String order) {
        try {
            JsonNode node = objectMapper.readTree(order);
            return node.get("quantity").asLong();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid quantity: " + e.getMessage());
        }
    }

    private Double extractPrice(String order) {
        try {
            JsonNode node = objectMapper.readTree(order);
            return node.get("initPrice").asDouble();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid initPrice: " + e.getMessage());
        }
    }

    private String extractSide(String order) {
        try {
            JsonNode node = objectMapper.readTree(order);
            return node.get("side").asText();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid side: " + e.getMessage());
        }
    }

    public String ping() {
        return "ok - orders service";
    }
}