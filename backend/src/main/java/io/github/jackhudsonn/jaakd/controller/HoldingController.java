package io.github.jackhudsonn.jaakd.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.dto.PortfolioReconciliationResponse;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.service.HoldingService;
import io.github.jackhudsonn.jaakd.service.PortfolioReconciliationService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/holdings")
public class HoldingController {

	private final HoldingService holdingService;
	private final PortfolioReconciliationService portfolioReconciliationService;

	public HoldingController(
		HoldingService holdingService,
		PortfolioReconciliationService portfolioReconciliationService
	) {
		this.holdingService = holdingService;
		this.portfolioReconciliationService = portfolioReconciliationService;
	}

	@GetMapping("/portfolio/{portfolioId}")
	@ResponseStatus(HttpStatus.OK)
	public List<Holding> getHoldingsByPortfolio(@PathVariable UUID portfolioId) {
		return holdingService.getHoldingsForPortfolio(portfolioId);
	}

	@GetMapping("/portfolio/{portfolioId}/reconcile")
	@ResponseStatus(HttpStatus.OK)
	public PortfolioReconciliationResponse reconcileHoldingsForPortfolio(@PathVariable UUID portfolioId) {
		return portfolioReconciliationService.reconcilePortfolio(portfolioId);
	}

	@GetMapping("/{holdingId}")
	@ResponseStatus(HttpStatus.OK)
	public Holding getHoldingById(@PathVariable UUID holdingId) {
		return holdingService.getHoldingById(holdingId);
	}

	@GetMapping("/{holdingId}/position-lots")
	@ResponseStatus(HttpStatus.OK)
	public List<PositionLotResponse> getPositionLotsByHolding(@PathVariable UUID holdingId) {
		return holdingService.getPositionLotsForHolding(holdingId);
	}

	@GetMapping("/{holdingId}/lot-matches")
	@ResponseStatus(HttpStatus.OK)
	public List<LotMatchResponse> getLotMatchesByHolding(@PathVariable UUID holdingId) {
		return holdingService.getLotMatchesForHolding(holdingId);
	}

}
