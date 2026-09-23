package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.ZonedDateTime;
import java.util.UUID;

// Maps to public.orders (named TradeOrder to avoid confusion with the SQL keyword / java.util types).
// `side` is now free-text (was boolean) — convention (e.g. "buy"/"sell") needs reconfirming after this schema change.
@Entity
@Table(name = "orderLogs")
public class OrderLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`logOrderID`")
    private UUID logOrderID;

    @Column(name = "orderID", nullable = false)
    private UUID orderID;

    @ManyToOne
    @JoinColumn(name = "`portfolioID`", nullable = false)
    private Portfolio portfolio;

    @ManyToOne
    @JoinColumn(name = "`instrumentID`", nullable = false)
    private Instrument instrument;

    @Column(name = "side", nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderSide side;

    @Column(name = "quantity", nullable = false)
    private double quantity;

    @Column(name = "timestamp", nullable = false)
    private ZonedDateTime timestamp;

    @Column(name = "metadata")
    private String metadata;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(name = "executionPrice")
    private double executionPrice;

    protected OrderLog() {
    }

    public OrderLog(UUID orderId, Portfolio portfolio, Instrument instrument, OrderSide side, double quantity) {
        this.orderID = orderId;
        this.portfolio = portfolio;
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
        this.timestamp = ZonedDateTime.now();
    }

    public UUID getOrderId() {
        return orderID;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public double getQuantity() {
        return quantity;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public ZonedDateTime getTimeStamp() {
        return timestamp;
    }

    public OrderSide getSide() {
        return side;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public double getExecutionPrice() {
        return executionPrice;
    }

    public void setExecutionPrice(double executionPrice) {
        this.executionPrice = executionPrice;
    }

    public UUID getLogOrderID() {
        return logOrderID;
    }

}
