package com.example.backend.transactions;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TransactionController {

    @GetMapping("/api/transactions")
    public String ping() {
        return "ok - transactions";
    }
}