package com.jaakd.transaction_service;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TransactionController {

    @GetMapping("/transactions")
    public String getTransactions() {
        return "Transaction list placeholder";
    }
}