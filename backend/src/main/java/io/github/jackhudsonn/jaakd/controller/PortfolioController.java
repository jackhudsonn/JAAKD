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

import io.github.jackhudsonn.jaakd.dto.CreatePortfolioRequest;
import io.github.jackhudsonn.jaakd.dto.PortfolioPerformancePointResponse;
import io.github.jackhudsonn.jaakd.dto.PortfolioResponse;
import io.github.jackhudsonn.jaakd.dto.UpdatePortfolioRequest;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.service.PortfolioPerformanceService;
import io.github.jackhudsonn.jaakd.service.PortfolioService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioController {

	private final PortfolioService portfolioService;
	private final PortfolioPerformanceService portfolioPerformanceService;

	public PortfolioController(
			PortfolioService portfolioService,
			PortfolioPerformanceService portfolioPerformanceService
	) {
		this.portfolioService = portfolioService;
		this.portfolioPerformanceService = portfolioPerformanceService;
	}

	@GetMapping
	@ResponseStatus(HttpStatus.OK)
	public List<PortfolioResponse> getCurrentUserPortfolios() {
		List<Portfolio> portfolios = portfolioService.getCurrentUserPortfolios();
		List<PortfolioResponse> responses = new ArrayList<>();

		for (int i = 0; i < portfolios.size(); i++) {
			Portfolio portfolio = portfolios.get(i);
			responses.add(toResponse(portfolio));
		}

		return responses;
	}

	@GetMapping("/{portfolioId}")
	@ResponseStatus(HttpStatus.OK)
	public PortfolioResponse getPortfolioById(@PathVariable UUID portfolioId) {
		Portfolio portfolio = portfolioService.getCurrentUserPortfolioById(portfolioId);
		return toResponse(portfolio);
	}

	@GetMapping("/{portfolioId}/performance")
	@ResponseStatus(HttpStatus.OK)
	public List<PortfolioPerformancePointResponse> getPortfolioPerformance(@PathVariable UUID portfolioId) {
		Portfolio portfolio = portfolioService.getCurrentUserPortfolioById(portfolioId);
		List<PortfolioPerformanceService.DailyValue> dailyValues =
				portfolioPerformanceService.getDailyValues(portfolio.getPortfolioId());
		List<PortfolioPerformancePointResponse> responses = new ArrayList<>();

		for (int i = 0; i < dailyValues.size(); i++) {
			PortfolioPerformanceService.DailyValue dailyValue = dailyValues.get(i);
			responses.add(new PortfolioPerformancePointResponse(dailyValue.date(), dailyValue.value()));
		}

		return responses;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public PortfolioResponse createPortfolio(@Valid @RequestBody CreatePortfolioRequest request) {
		Portfolio created = portfolioService.createPortfolio(request);
		return toResponse(created);
	}

	@PutMapping("/{portfolioId}")
	@ResponseStatus(HttpStatus.OK)
	public PortfolioResponse updatePortfolio(
			@PathVariable UUID portfolioId,
			@Valid @RequestBody UpdatePortfolioRequest request
	) {
		Portfolio updated = portfolioService.updatePortfolio(portfolioId, request);
		return toResponse(updated);
	}

	@DeleteMapping("/{portfolioId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deletePortfolio(@PathVariable UUID portfolioId) {
		portfolioService.deletePortfolio(portfolioId);
	}

	private PortfolioResponse toResponse(Portfolio portfolio) {
		return new PortfolioResponse(
				portfolio.getPortfolioId(),
				portfolio.getPortfolioName()
		);
	}
}
