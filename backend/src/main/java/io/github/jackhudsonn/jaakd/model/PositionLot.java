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
@Table(name = "position_lots")
public class PositionLot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`positionLotID`")
    private UUID positionLotID;

    @Column(name = "`holdingID`", nullable = false)
    private UUID holdingID;

    @Column(name = "`sourceBuyLogOrderID`", nullable = false)
    private UUID sourceBuyLogOrderID;

    @Column(name = "openedAt", nullable = false)
    private ZonedDateTime openedAt;

    @Column(name = "originalQuantity", nullable = false)
    private BigDecimal originalQuantity;

    @Column(name = "remainingQuantity", nullable = false)
    private BigDecimal remainingQuantity;

    @Column(name = "unitCost", nullable = false)
    private BigDecimal unitCost;

    protected PositionLot() {
    }

    public PositionLot(
        UUID holdingID,
        UUID sourceBuyLogOrderID,
        ZonedDateTime openedAt,
        BigDecimal originalQuantity,
        BigDecimal remainingQuantity,
        BigDecimal unitCost
    ) {
        this.holdingID = holdingID;
        this.sourceBuyLogOrderID = sourceBuyLogOrderID;
        this.openedAt = openedAt;
        this.originalQuantity = originalQuantity;
        this.remainingQuantity = remainingQuantity;
        this.unitCost = unitCost;
    }

    public UUID getPositionLotID() {
        return positionLotID;
    }

    public UUID getHoldingID() {
        return holdingID;
    }

    public UUID getSourceBuyLogOrderID() {
        return sourceBuyLogOrderID;
    }

    public ZonedDateTime getOpenedAt() {
        return openedAt;
    }

    public BigDecimal getOriginalQuantity() {
        return originalQuantity;
    }

    public BigDecimal getRemainingQuantity() {
        return remainingQuantity;
    }

    public void setRemainingQuantity(BigDecimal remainingQuantity) {
        this.remainingQuantity = remainingQuantity;
    }

    public BigDecimal getUnitCost() {
        return unitCost;
    }
}