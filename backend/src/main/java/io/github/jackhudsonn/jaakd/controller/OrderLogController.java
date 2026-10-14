package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateOrderLogRequest;
import io.github.jackhudsonn.jaakd.dto.OrderLogListResponse;
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
	public OrderLogListResponse getOrderLogsByPortfolio(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getOrderLogsForPortfolio(portfolioId);
		return toListResponse(orderLogs);
	}

	@GetMapping("/portfolio/{portfolioId}/fx")
	@ResponseStatus(HttpStatus.OK)
	public OrderLogListResponse getFxOrderLogsByPortfolio(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getFxOrderLogsForPortfolio(portfolioId);
		return toListResponse(orderLogs);
	}

	@GetMapping("/diagnostics/portfolio/{portfolioId}")
	@ResponseStatus(HttpStatus.OK)
	public OrderLogListResponse getOrderLogsByPortfolioForDiagnostics(@PathVariable UUID portfolioId) {
		List<OrderLog> orderLogs = orderLogService.getOrderLogsForPortfolioDiagnostics(portfolioId);
		return toListResponse(orderLogs);
	}

	private OrderLogListResponse toListResponse(List<OrderLog> orderLogs) {
		List<OrderLogResponse> responses = new ArrayList<>();

		for (OrderLog orderLog : orderLogs) {
			responses.add(toResponse(orderLog));
		}

		return new OrderLogListResponse(responses);
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
				orderLog.getExecutionPrice(),
				orderLog.getQuotedPrice()
		);
	}
}
