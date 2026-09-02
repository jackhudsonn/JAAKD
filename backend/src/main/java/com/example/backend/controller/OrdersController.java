package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.service.OrdersService;

import java.util.UUID;

@RestController
public class OrdersController {

    private final OrdersService ordersService;

    public OrdersController(OrdersService ordersService) {
        this.ordersService = ordersService;
    }

    @GetMapping("/api/orders")
    public String ping() {
        return ordersService.ping();
    }

    @PostMapping("/api/orders/place")
    public String placeOrder(@RequestBody String order) {
        return ordersService.placeOrder(order);
    }

    @PostMapping("/api/orders/{orderId}/accept")
    public String acceptOrder(@PathVariable UUID orderId) {
        return ordersService.acceptOrder(orderId);
    }

    @PostMapping("/api/orders/{orderId}/execute")
    public String executeOrder(@PathVariable UUID orderId, @RequestBody ExecuteOrderRequest request) {
        return ordersService.executeOrder(orderId, request.getExecutionPrice());
    }

}

// Simple request DTO for execution price
class ExecuteOrderRequest {
    private Double executionPrice;

    public Double getExecutionPrice() {
        return executionPrice;
    }

    public void setExecutionPrice(Double executionPrice) {
        this.executionPrice = executionPrice;
    }
}