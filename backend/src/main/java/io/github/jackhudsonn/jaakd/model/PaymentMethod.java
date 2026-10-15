package io.github.jackhudsonn.jaakd.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment_methods")
public class PaymentMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`paymentMethodID`")
    private UUID paymentMethodId;

    @Column(name = "`userID`", nullable = false)
    private UUID userId;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Column(name = "`accountHolderName`", nullable = false)
    private String accountHolderName;

    @Column(name = "`bankName`", nullable = false)
    private String bankName;

    @Column(name = "`accountType`", nullable = false)
    private String accountType;

    @Column(name = "`routingNumber`", nullable = false)
    private String routingNumber;

    @Column(name = "`accountNumber`", nullable = false)
    private String accountNumber;

    @Column(name = "`createdAt`", nullable = false)
    private Instant createdAt;

    @Column(name = "`updatedAt`", nullable = false)
    private Instant updatedAt;

    protected PaymentMethod() {
    }

    public PaymentMethod(
        UUID userId,
        String nickname,
        String accountHolderName,
        String bankName,
        String accountType,
        String routingNumber,
        String accountNumber
    ) {
        this.userId = userId;
        this.nickname = nickname;
        this.accountHolderName = accountHolderName;
        this.bankName = bankName;
        this.accountType = accountType;
        this.routingNumber = routingNumber;
        this.accountNumber = accountNumber;
    }

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getPaymentMethodId() {
        return paymentMethodId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getNickname() {
        return nickname;
    }

    public String getAccountHolderName() {
        return accountHolderName;
    }

    public String getBankName() {
        return bankName;
    }

    public String getAccountType() {
        return accountType;
    }

    public String getRoutingNumber() {
        return routingNumber;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
