package com.example.backend.orders;

import org.springframework.stereotype.Service;

@Service
public class OrdersService {

    public String ping() {
        return "ok - orders service";
    }
}