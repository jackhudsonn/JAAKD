package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateHoldingRequest;
import io.github.jackhudsonn.jaakd.dto.HoldingResponse;
import io.github.jackhudsonn.jaakd.dto.UpdateHoldingRequest;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.service.HoldingService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/holdings")
public class HoldingController {

	private final HoldingService holdingService;

	public HoldingController(HoldingService holdingService) {
		this.holdingService = holdingService;
	}

	@GetMapping("/portfolio/{portfolioId}")
	public ResponseEntity<List<HoldingResponse>> getHoldingsByPortfolio(@PathVariable UUID portfolioId) {
		List<Holding> holdings = holdingService.getHoldingsForPortfolio(portfolioId);
		List<HoldingResponse> responses = new ArrayList<>();

		for (int i = 0; i < holdings.size(); i++) {
			responses.add(toResponse(holdings.get(i)));
		}

		return ResponseEntity.ok(responses);
	}

	@GetMapping("/{holdingId}")
	public ResponseEntity<HoldingResponse> getHoldingById(@PathVariable UUID holdingId) {
		Holding holding = holdingService.getHoldingById(holdingId);
		return ResponseEntity.ok(toResponse(holding));
	}

	@PostMapping
	public ResponseEntity<HoldingResponse> createHolding(@Valid @RequestBody CreateHoldingRequest request) {
		Holding created = holdingService.createHolding(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
	}

	@PutMapping("/{holdingId}")
	public ResponseEntity<HoldingResponse> updateHolding(
			@PathVariable UUID holdingId,
			@Valid @RequestBody UpdateHoldingRequest request
	) {
		Holding updated = holdingService.updateHolding(holdingId, request);
		return ResponseEntity.ok(toResponse(updated));
	}

	@DeleteMapping("/{holdingId}")
	public ResponseEntity<Void> deleteHolding(@PathVariable UUID holdingId) {
		holdingService.deleteHolding(holdingId);
		return ResponseEntity.noContent().build();
	}

	private HoldingResponse toResponse(Holding holding) {
		return new HoldingResponse(
				holding.getHoldingId(),
				holding.getPortfolio().getPortfolioId(),
				holding.getInstrument().getInstrumentId(),
				holding.getCurrentQuantity()
		);
	}
}
