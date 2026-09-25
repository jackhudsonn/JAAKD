package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateOrderLogRequest;
import io.github.jackhudsonn.jaakd.dto.OrderLogResponse;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.service.OrderLogService;

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
	@ResponseStatus(HttpStatus.OK)
	public List<OrderLogResponse> getOrderLogsByPortfolio(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getOrderLogsForPortfolio(portfolioId);
		List<OrderLogResponse> responses = new ArrayList<>();

		for (int i = 0; i < orderLogs.size(); i++) {
			responses.add(toResponse(orderLogs.get(i)));
		}

		return responses;
	}

	@GetMapping("/diagnostics/portfolio/{portfolioId}")
	@ResponseStatus(HttpStatus.OK)
	public List<OrderLogResponse> getOrderLogsByPortfolioForDiagnostics(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getOrderLogsForPortfolioDiagnostics(portfolioId);
		List<OrderLogResponse> responses = new ArrayList<>();

		for (int i = 0; i < orderLogs.size(); i++) {
			responses.add(toResponse(orderLogs.get(i)));
		}

		return responses;
	}

	@GetMapping("/{logOrderId}")
	@ResponseStatus(HttpStatus.OK)
	public OrderLogResponse getOrderLogById(@PathVariable UUID logOrderId) {
		OrderLog orderLog = orderLogService.getOrderLogById(logOrderId);
		return toResponse(orderLog);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrderLogResponse createOrderLog(@Valid @RequestBody CreateOrderLogRequest request) {
		OrderLog created = orderLogService.createOrderLog(request);
		return toResponse(created);
	}

	// TODO: Need to add perimission check for executing order logs (ONLY ADMIN)
	// should we pass orderID instead of logOrderId for consistency with cancel endpoint?
	@PostMapping("/{logOrderId}/execute")
	@ResponseStatus(HttpStatus.OK)
	public OrderLogResponse markOrderLogExecuted(
			@PathVariable UUID logOrderId,
			@RequestParam(required = false) Double executionPrice
	) {
		OrderLog updated = orderLogService.markExecuted(logOrderId, executionPrice);
		return toResponse(updated);
	}

	@PostMapping("/{orderId}/cancel")
	@ResponseStatus(HttpStatus.OK)
	public OrderLogResponse cancelOrder(@PathVariable UUID orderId) {
		OrderLog cancelled = orderLogService.cancelOrder(orderId);
		return toResponse(cancelled);
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
