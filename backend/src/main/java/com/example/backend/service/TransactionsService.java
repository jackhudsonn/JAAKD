package com.example.backend.service;

import org.springframework.stereotype.Service;

@Service
public class TransactionsService {

    public String ping() {
        return "ok - transactions service";
    }

    public String createTransaction(String entity) {
        // TODO: Implement the logic to create a transaction
        return "Transaction created: " + entity;
    }

    public String updateTransaction(String entity) {
        // TODO: Implement the logic to update a transaction
        return "Transaction updated: " + entity;
    }
}