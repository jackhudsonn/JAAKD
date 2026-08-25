package com.example.backend.transactions;

import org.springframework.stereotype.Service;

@Service
public class TransactionsService {

    public String ping() {
        return "ok - transactions service";
    }
}