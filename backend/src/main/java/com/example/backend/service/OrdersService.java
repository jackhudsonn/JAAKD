package com.example.backend.service;

import org.springframework.stereotype.Service;

@Service
public class OrdersService {

    public String ping() {
        return "ok - orders service";
    }

    public String createOrder(String order) {
        // TODO: Implement order creation logic here
        return "Order created: " + order;
    }

    public String updateOrder(String order) {
        // TODO: Implement order update logic here
        return "Order updated: " + order;
    }

    public String validateOrder(String order) {
        // TODO: Implement order validation logic here
        return "Order validated: " + order;
    }
}