package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.service.OrdersService;

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

    @PostMapping("/api/orders/create")
    public String createOrder(@RequestBody String order) {
        // ordersService.validateOrder(order)
        return ordersService.createOrder(order);
    }

    @PostMapping("/api/orders/update")
    public String updateOrder(@RequestBody String order) {
        return ordersService.updateOrder(order);
    }

}