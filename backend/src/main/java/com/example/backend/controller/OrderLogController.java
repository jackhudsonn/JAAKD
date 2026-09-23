package com.example.backend.controller;

import com.example.backend.dto.CreateOrderLogRequest;
import com.example.backend.dto.OrderLogResponse;
import com.example.backend.model.OrderLog;
import com.example.backend.service.OrderLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/order-logs")
public class OrderLogController {

	private final OrderLogService orderLogService;

	public OrderLogController(OrderLogService orderLogService) {
		this.orderLogService = orderLogService;
	}

	@GetMapping("/portfolio/{portfolioId}")
	public ResponseEntity<List<OrderLogResponse>> getOrderLogsByPortfolio(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getOrderLogsForPortfolio(portfolioId);
		List<OrderLogResponse> responses = new ArrayList<>();

		for (int i = 0; i < orderLogs.size(); i++) {
			responses.add(toResponse(orderLogs.get(i)));
		}

		return ResponseEntity.ok(responses);
	}

	@GetMapping("/{logOrderId}")
	public ResponseEntity<OrderLogResponse> getOrderLogById(@PathVariable UUID logOrderId) {
		OrderLog orderLog = orderLogService.getOrderLogById(logOrderId);
		return ResponseEntity.ok(toResponse(orderLog));
	}

	@PostMapping
	public ResponseEntity<OrderLogResponse> createOrderLog(@Valid @RequestBody CreateOrderLogRequest request) {
		OrderLog created = orderLogService.createOrderLog(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
	}

	private OrderLogResponse toResponse(OrderLog orderLog) {
		return new OrderLogResponse(
				orderLog.getLogOrderID(),
				orderLog.getOrderId(),
				orderLog.getPortfolio().getPortfolioId(),
				orderLog.getInstrument().getInstrumentId(),
				orderLog.getSide(),
				orderLog.getQuantity(),
				orderLog.getTimeStamp(),
				orderLog.getMetadata(),
				orderLog.getStatus(),
				orderLog.getExecutionPrice()
		);
	}
}
