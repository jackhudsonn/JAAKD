package com.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Maps to public.logs — the order execution/status trail (named OrderLog to avoid clashing with logging frameworks).
@Entity
@Table(name = "transactionLogs")
public class TransactionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "`tlogID`")
    private UUID tlogId;

    @Column(name = "`transactionID`", nullable = false)
    private UUID transactionId;

    @Column(name = "`tlogTime`", nullable = false)
    private Instant tlogTime;

    @Column(name = "tstatus", nullable = false)
    private String tstatus = "Placed";


    protected TransactionLog() {
    }

    public TransactionLog(UUID transactionId) {
        this.transactionId = transactionId;
    }

    public UUID getTLogId() {
        return tlogId;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public Instant getTLogTime() {
        return tlogTime;
    }

    public String getTStatus() {
        return tstatus;
    }

    public void setTStatus(String status) {
        this.tstatus = status;
    }

}
