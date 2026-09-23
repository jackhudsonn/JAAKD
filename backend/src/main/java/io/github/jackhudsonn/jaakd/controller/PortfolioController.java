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

import io.github.jackhudsonn.jaakd.dto.CreatePortfolioRequest;
import io.github.jackhudsonn.jaakd.dto.PortfolioResponse;
import io.github.jackhudsonn.jaakd.dto.UpdatePortfolioRequest;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.service.PortfolioService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioController {

	private final PortfolioService portfolioService;

	public PortfolioController(PortfolioService portfolioService) {
		this.portfolioService = portfolioService;
	}

	@GetMapping
	public ResponseEntity<List<PortfolioResponse>> getCurrentUserPortfolios() {
		List<Portfolio> portfolios = portfolioService.getCurrentUserPortfolios();
		List<PortfolioResponse> responses = new ArrayList<>();

		for (int i = 0; i < portfolios.size(); i++) {
			Portfolio portfolio = portfolios.get(i);
			responses.add(toResponse(portfolio));
		}

		return ResponseEntity.ok(responses);
	}

	@GetMapping("/{portfolioId}")
	public ResponseEntity<PortfolioResponse> getPortfolioById(@PathVariable UUID portfolioId) {
		Portfolio portfolio = portfolioService.getCurrentUserPortfolioById(portfolioId);
		return ResponseEntity.ok(toResponse(portfolio));
	}

	@PostMapping
	public ResponseEntity<PortfolioResponse> createPortfolio(@Valid @RequestBody CreatePortfolioRequest request) {
		Portfolio created = portfolioService.createPortfolio(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
	}

	@PutMapping("/{portfolioId}")
	public ResponseEntity<PortfolioResponse> updatePortfolio(
			@PathVariable UUID portfolioId,
			@Valid @RequestBody UpdatePortfolioRequest request
	) {
		Portfolio updated = portfolioService.updatePortfolio(portfolioId, request);
		return ResponseEntity.ok(toResponse(updated));
	}

	@DeleteMapping("/{portfolioId}")
	public ResponseEntity<Void> deletePortfolio(@PathVariable UUID portfolioId) {
		portfolioService.deletePortfolio(portfolioId);
		return ResponseEntity.noContent().build();
	}

	private PortfolioResponse toResponse(Portfolio portfolio) {
		return new PortfolioResponse(
				portfolio.getPortfolioId(),
				portfolio.getPortfolioName()
		);
	}
}
