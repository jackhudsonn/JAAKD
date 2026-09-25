package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.InstrumentResponse;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.service.InstrumentService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {

	private final InstrumentService instrumentService;

	public InstrumentController(InstrumentService instrumentService) {
		this.instrumentService = instrumentService;
	}

	@GetMapping
	@ResponseStatus(HttpStatus.OK)
	public List<InstrumentResponse> getAllInstruments() {
		List<Instrument> instruments = instrumentService.getAllInstruments();
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
		// TODO: Keep this endpoint wired so frontend can call it later.
		// TODO: Once data provider API is ready, service will fetch and upsert data.
		Instrument synced = instrumentService.createOrUpdateFromExternalData(ticker);
		return toResponse(synced);
	}

	private InstrumentResponse toResponse(Instrument instrument) {
		return new InstrumentResponse(
				instrument.getInstrumentId(),
				instrument.getTicker(),
				instrument.getMarket(),
				instrument.getName(),
				instrument.getInstrumentClass(),
				instrument.getLogoUrl(),
				instrument.getDescription()
		);
	}
}
