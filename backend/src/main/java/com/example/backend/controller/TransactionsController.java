package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.service.TransactionsService;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
public class TransactionsController {

    private final TransactionsService transactionsService;

    public TransactionsController(TransactionsService transactionsService) {
        this.transactionsService = transactionsService;
    }

    @GetMapping("/api/transactions")
    public String ping() {
        return transactionsService.ping();
    }

    @PostMapping("/api/transactions/create")
    public String createTransaction(@RequestBody String entity) {        
        return transactionsService.createTransaction(entity);
    }

    @PostMapping("/api/transactions/update")
    public String updateTransaction(@RequestBody String entity) {
        return transactionsService.updateTransaction(entity);
    }
    
    
}