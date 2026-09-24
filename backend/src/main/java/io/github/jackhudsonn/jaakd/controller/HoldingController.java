package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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
	@ResponseStatus(HttpStatus.OK)
	public List<HoldingResponse> getHoldingsByPortfolio(@PathVariable UUID portfolioId) {
		List<Holding> holdings = holdingService.getHoldingsForPortfolio(portfolioId);
		List<HoldingResponse> responses = new ArrayList<>();

		for (int i = 0; i < holdings.size(); i++) {
			responses.add(toResponse(holdings.get(i)));
		}

		return responses;
	}

	@GetMapping("/{holdingId}")
	@ResponseStatus(HttpStatus.OK)
	public HoldingResponse getHoldingById(@PathVariable UUID holdingId) {
		Holding holding = holdingService.getHoldingById(holdingId);
		return toResponse(holding);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public HoldingResponse createHolding(@Valid @RequestBody CreateHoldingRequest request) {
		Holding created = holdingService.createHolding(request);
		return toResponse(created);
	}

	@PutMapping("/{holdingId}")
	@ResponseStatus(HttpStatus.OK)
	public HoldingResponse updateHolding(
			@PathVariable UUID holdingId,
			@Valid @RequestBody UpdateHoldingRequest request
	) {
		Holding updated = holdingService.updateHolding(holdingId, request);
		return toResponse(updated);
	}

	@DeleteMapping("/{holdingId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteHolding(@PathVariable UUID holdingId) {
		holdingService.deleteHolding(holdingId);
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
