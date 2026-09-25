package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "holdings")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`holdingID`")
    private UUID holdingID;

    @Column(name = "`portfolioID`", nullable = false)
    private UUID portfolioID;

    @Column(name = "`instrumentID`", nullable = false)
    private UUID instrumentID;

    @Column(name = "currentQuantity")
    private BigDecimal currentQuantity;

    @Column(name = "cumulativeRealizedPnl")
    private BigDecimal cumulativeRealizedPnl;

    @Column(name = "updatedAt")
    private ZonedDateTime updatedAt;

    protected Holding() {
    }

    public Holding(UUID holdingID, UUID portfolioID, UUID instrumentID) {
        this.holdingID = holdingID;
        this.portfolioID = portfolioID;
        this.instrumentID = instrumentID;
        this.currentQuantity = BigDecimal.ZERO;
        this.cumulativeRealizedPnl = BigDecimal.ZERO;
        this.updatedAt = ZonedDateTime.now();
    }

    public Holding(UUID portfolioID, UUID instrumentID) {
        this.portfolioID = portfolioID;
        this.instrumentID = instrumentID;
        this.currentQuantity = BigDecimal.ZERO;
        this.cumulativeRealizedPnl = BigDecimal.ZERO;
        this.updatedAt = ZonedDateTime.now();
    }

    public UUID getHoldingID() {
        return holdingID;
    }

    public UUID getPortfolioID() {
        return portfolioID;
    }

    public UUID getInstrumentID() {
        return instrumentID;
    }

    public BigDecimal getCurrentQuantity() {
        return currentQuantity;
    }

    public void setCurrentQuantity(BigDecimal currentQuantity) {
        this.currentQuantity = currentQuantity;
    }

    public BigDecimal getCumulativeRealizedPnl() {
        return cumulativeRealizedPnl;
    }

    public void setCumulativeRealizedPnl(BigDecimal cumulativeRealizedPnl) {
        this.cumulativeRealizedPnl = cumulativeRealizedPnl;
    }

    public ZonedDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(ZonedDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
