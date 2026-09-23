package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateTradeRequest;
import io.github.jackhudsonn.jaakd.dto.TradeResponse;
import io.github.jackhudsonn.jaakd.model.Trade;
import io.github.jackhudsonn.jaakd.service.TradeService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trades")
public class TradeController {

	private final TradeService tradeService;

	public TradeController(TradeService tradeService) {
		this.tradeService = tradeService;
	}

	@GetMapping("/holding/{holdingId}")
	public ResponseEntity<List<TradeResponse>> getTradesByHolding(@PathVariable UUID holdingId) {
		List<Trade> trades = tradeService.getTradesForHolding(holdingId);
		List<TradeResponse> responses = new ArrayList<>();

		for (int i = 0; i < trades.size(); i++) {
			responses.add(toResponse(trades.get(i)));
		}

		return ResponseEntity.ok(responses);
	}

	@GetMapping("/{tradeId}")
	public ResponseEntity<TradeResponse> getTradeById(@PathVariable UUID tradeId) {
		Trade trade = tradeService.getTradeById(tradeId);
		return ResponseEntity.ok(toResponse(trade));
	}

	@PostMapping
	public ResponseEntity<TradeResponse> createTrade(@Valid @RequestBody CreateTradeRequest request) {
		Trade created = tradeService.createTrade(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
	}

	private TradeResponse toResponse(Trade trade) {
		return new TradeResponse(
				trade.getTradeID(),
				trade.getHolding().getHoldingId(),
				trade.getOrderLog().getLogOrderID()
		);
	}
}
