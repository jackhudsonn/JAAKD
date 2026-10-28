package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.InstrumentCandleResponse;
import io.github.jackhudsonn.jaakd.dto.InstrumentResponse;
import io.github.jackhudsonn.jaakd.dto.SyncCryptoInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.service.InstrumentService;
import io.github.jackhudsonn.jaakd.service.PriceHistoryService;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceQuoteResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {

	private final InstrumentService instrumentService;
	private final PriceHistoryService priceHistoryService;

	public InstrumentController(InstrumentService instrumentService, PriceHistoryService priceHistoryService) {
		this.instrumentService = instrumentService;
		this.priceHistoryService = priceHistoryService;
	}

	@GetMapping
	@ResponseStatus(HttpStatus.OK)
	public List<InstrumentResponse> getAllInstruments(
			@RequestParam(required = false) InstrumentClass instrumentType,
			@RequestParam(required = false) String query,
			@RequestParam(required = false) Integer page,
			@RequestParam(required = false) Integer size
	) {
		List<Instrument> instruments = instrumentService.getAllInstruments(instrumentType, query, page, size);
		List<InstrumentResponse> responses = new ArrayList<>();

		for (int i = 0; i < instruments.size(); i++) {
			Instrument instrument = instruments.get(i);
			responses.add(toResponse(instrument));
		}

		return responses;
	}

	@GetMapping("/{instrumentId}")
	@ResponseStatus(HttpStatus.OK)
	public InstrumentResponse getInstrumentById(@PathVariable UUID instrumentId) {
		Instrument instrument = instrumentService.getInstrumentById(instrumentId);
		return toResponse(instrument);
	}

	@GetMapping("/{instrumentId}/candles")
	@ResponseStatus(HttpStatus.OK)
	public List<InstrumentCandleResponse> getCandles(
			@PathVariable UUID instrumentId,
			@RequestParam(required = false) LocalDate from,
			@RequestParam(required = false) LocalDate to
	) {
		return instrumentService.getCandles(instrumentId, from, to);
	}

	@GetMapping("/ticker/{ticker}")
	@ResponseStatus(HttpStatus.OK)
	public InstrumentResponse getInstrumentByTicker(@PathVariable String ticker) {
		Instrument instrument = instrumentService.getInstrumentByTicker(ticker);
		return toResponse(instrument);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public InstrumentResponse createInstrument(@Valid @RequestBody CreateInstrumentRequest request) {
		Instrument created = instrumentService.createInstrument(request);
		return toResponse(created);
	}

	@PutMapping("/{instrumentId}")
	@ResponseStatus(HttpStatus.OK)
	public InstrumentResponse updateInstrument(
			@PathVariable UUID instrumentId,
			@Valid @RequestBody UpdateInstrumentRequest request
	) {
		Instrument updated = instrumentService.updateInstrument(instrumentId, request);
		return toResponse(updated);
	}

	@PostMapping("/sync/{ticker}")
	@ResponseStatus(HttpStatus.OK)
	public InstrumentResponse syncInstrumentFromExternalApi(@PathVariable String ticker) {
		Instrument synced = instrumentService.createOrUpdateFromExternalData(ticker);
		return toResponse(synced);
	}

	@PostMapping("/sync/crypto")
	@ResponseStatus(HttpStatus.OK)
	public InstrumentResponse syncCryptoInstrumentFromExternalApi(
		@Valid @RequestBody SyncCryptoInstrumentRequest request
	) {
		Instrument synced = instrumentService.createOrUpdateCryptoFromExternalData(
			request.baseTicker(),
			request.quoteCurrency()
		);
		return toResponse(synced);
	}

	// Admin-only: refetches daily candles for every non-cash instrument in the background.
	@PostMapping("/prices/refresh")
	@ResponseStatus(HttpStatus.ACCEPTED)
	public void refreshPriceHistory() {
		priceHistoryService.startRefresh();
	}

	@GetMapping("/quotes/{ticker}")
	@ResponseStatus(HttpStatus.OK)
	public FauxnanceQuoteResponse getQuoteByTicker(@PathVariable String ticker) {
		return instrumentService.getQuoteByTicker(ticker);
	}

	@GetMapping("/quotes")
	@ResponseStatus(HttpStatus.OK)
	public List<FauxnanceQuoteResponse> getQuotesByTickers(@RequestParam List<String> symbols) {
		return instrumentService.getQuotesByTickers(symbols);
	}

	private InstrumentResponse toResponse(Instrument instrument) {
		return new InstrumentResponse(
				instrument.getInstrumentId(),
				instrument.getTicker(),
				instrument.getMarket(),
				instrument.getName(),
				instrument.getInstrumentClass(),
				instrument.getTradingCurrency(),
				instrument.getLogoUrl(),
				instrument.getDescription()
		);
	}
}
