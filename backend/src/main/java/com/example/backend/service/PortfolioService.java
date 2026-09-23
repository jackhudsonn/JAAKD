package com.example.backend.service;

import com.example.backend.dto.CreatePortfolioRequest;
import com.example.backend.dto.UpdatePortfolioRequest;
import com.example.backend.model.Portfolio;
import com.example.backend.model.Profile;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.repository.ProfileRepository;
import com.example.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PortfolioService {

	private final PortfolioRepository portfolioRepository;
	private final ProfileRepository profileRepository;
	private final CurrentUserService currentUserService;

	public PortfolioService(
			PortfolioRepository portfolioRepository,
			ProfileRepository profileRepository,
			CurrentUserService currentUserService
	) {
		this.portfolioRepository = portfolioRepository;
		this.profileRepository = profileRepository;
		this.currentUserService = currentUserService;
	}

	public List<Portfolio> getCurrentUserPortfolios() {
		UUID userId = currentUserService.getUserId();
		return portfolioRepository.findByProfileUserId(userId);
	}

	public Portfolio getCurrentUserPortfolioById(UUID portfolioId) {
		UUID userId = currentUserService.getUserId();

		return portfolioRepository.findByPortfolioIdAndProfileUserId(portfolioId, userId)
				.orElseThrow(() -> new IllegalArgumentException("Portfolio not found for id: " + portfolioId));
	}

	@Transactional
	public Portfolio createPortfolio(CreatePortfolioRequest request) {
		// 1. Resolve current user
		UUID userId = currentUserService.getUserId();

		// 2. Fetch profile owner
		Profile profile = profileRepository.findById(userId)
				.orElseThrow(() -> new IllegalArgumentException("Profile not found for user: " + userId));

		// 3. Build and save portfolio
		Portfolio portfolio = new Portfolio(profile);
		portfolio.setPortfolioName(request.portfolioName());

		return portfolioRepository.save(portfolio);
	}

	@Transactional
	public Portfolio updatePortfolio(UUID portfolioId, UpdatePortfolioRequest request) {
		// 1. Resolve current user
		UUID userId = currentUserService.getUserId();

		// 2. Fetch user-owned portfolio
		Portfolio portfolio = portfolioRepository.findByPortfolioIdAndProfileUserId(portfolioId, userId)
				.orElseThrow(() -> new IllegalArgumentException("Portfolio not found for id: " + portfolioId));

		// 3. Apply updates
		portfolio.setPortfolioName(request.portfolioName());

		// 4. Save changes
		return portfolioRepository.save(portfolio);
	}

	@Transactional
	public void deletePortfolio(UUID portfolioId) {
		// 1. Resolve current user
		UUID userId = currentUserService.getUserId();

		// 2. Fetch user-owned portfolio
		Portfolio portfolio = portfolioRepository.findByPortfolioIdAndProfileUserId(portfolioId, userId)
				.orElseThrow(() -> new IllegalArgumentException("Portfolio not found for id: " + portfolioId));

		// 3. Delete portfolio
		portfolioRepository.delete(portfolio);
	}
}
