package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.TransactionDtos;
import com.example.backend.service.TransactionService;

import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
public class TransactionsController {

    private final TransactionService transactionService;

    public TransactionsController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/ping")
    public String ping() {
        return transactionService.ping();
    }

    // ==================== STEP 1: PLACE ====================
    @PostMapping("/place")
    public String placeTransaction(@RequestBody TransactionDtos transaction) {
        return transactionService.placeTransaction(transaction);
    }

    // ==================== STEP 2: ACCEPT ====================
    @PostMapping("/accept/{transactionId}")
    public String acceptTransaction(@PathVariable UUID transactionId) {
        return transactionService.acceptTransaction(transactionId);
    }

    // ==================== STEP 3: EXECUTE ====================
    @PostMapping("/execute/{transactionId}")
    public String executeTransaction(@PathVariable UUID transactionId) {
        return transactionService.executeTransaction(transactionId, null);
    }
}