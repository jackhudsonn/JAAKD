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
@Table(name = "lot_matches")
public class LotMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`lotMatchID`")
    private UUID lotMatchID;

    @Column(name = "`sellLogOrderID`", nullable = false)
    private UUID sellLogOrderID;

    @Column(name = "`positionLotID`", nullable = false)
    private UUID positionLotID;

    @Column(name = "`holdingID`", nullable = false)
    private UUID holdingID;

    @Column(name = "matchedQuantity", nullable = false)
    private BigDecimal matchedQuantity;

    @Column(name = "sellUnitPrice", nullable = false)
    private BigDecimal sellUnitPrice;

    @Column(name = "realizedPnlAmount", nullable = false)
    private BigDecimal realizedPnlAmount;

    @Column(name = "matchedAt", nullable = false)
    private ZonedDateTime matchedAt;

    protected LotMatch() {
    }

    public LotMatch(
        UUID sellLogOrderID,
        UUID positionLotID,
        UUID holdingID,
        BigDecimal matchedQuantity,
        BigDecimal sellUnitPrice,
        BigDecimal realizedPnlAmount,
        ZonedDateTime matchedAt
    ) {
        this.sellLogOrderID = sellLogOrderID;
        this.positionLotID = positionLotID;
        this.holdingID = holdingID;
        this.matchedQuantity = matchedQuantity;
        this.sellUnitPrice = sellUnitPrice;
        this.realizedPnlAmount = realizedPnlAmount;
        this.matchedAt = matchedAt;
    }

    public UUID getLotMatchID() {
        return lotMatchID;
    }

    public UUID getSellLogOrderID() {
        return sellLogOrderID;
    }

    public UUID getPositionLotID() {
        return positionLotID;
    }

    public UUID getHoldingID() {
        return holdingID;
    }

    public BigDecimal getMatchedQuantity() {
        return matchedQuantity;
    }

    public BigDecimal getSellUnitPrice() {
        return sellUnitPrice;
    }

    public BigDecimal getRealizedPnlAmount() {
        return realizedPnlAmount;
    }

    public ZonedDateTime getMatchedAt() {
        return matchedAt;
    }
}