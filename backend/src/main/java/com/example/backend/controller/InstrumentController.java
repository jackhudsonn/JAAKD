package com.example.backend.controller;

import com.example.backend.dto.CreateInstrumentRequest;
import com.example.backend.dto.InstrumentResponse;
import com.example.backend.dto.UpdateInstrumentRequest;
import com.example.backend.model.Instrument;
import com.example.backend.service.InstrumentService;
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
	public ResponseEntity<List<InstrumentResponse>> getAllInstruments() {
		List<Instrument> instruments = instrumentService.getAllInstruments();
		List<InstrumentResponse> responses = new ArrayList<>();

		for (int i = 0; i < instruments.size(); i++) {
			Instrument instrument = instruments.get(i);
			responses.add(toResponse(instrument));
		}

		return ResponseEntity.ok(responses);
	}

	@GetMapping("/{instrumentId}")
	public ResponseEntity<InstrumentResponse> getInstrumentById(@PathVariable UUID instrumentId) {
		Instrument instrument = instrumentService.getInstrumentById(instrumentId);
		return ResponseEntity.ok(toResponse(instrument));
	}

	@GetMapping("/ticker/{ticker}")
	public ResponseEntity<InstrumentResponse> getInstrumentByTicker(@PathVariable String ticker) {
		Instrument instrument = instrumentService.getInstrumentByTicker(ticker);
		return ResponseEntity.ok(toResponse(instrument));
	}

	@PostMapping
	public ResponseEntity<InstrumentResponse> createInstrument(@Valid @RequestBody CreateInstrumentRequest request) {
		Instrument created = instrumentService.createInstrument(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
	}

	@PutMapping("/{instrumentId}")
	public ResponseEntity<InstrumentResponse> updateInstrument(
			@PathVariable UUID instrumentId,
			@Valid @RequestBody UpdateInstrumentRequest request
	) {
		Instrument updated = instrumentService.updateInstrument(instrumentId, request);
		return ResponseEntity.ok(toResponse(updated));
	}

	@DeleteMapping("/{instrumentId}")
	public ResponseEntity<Void> deleteInstrument(@PathVariable UUID instrumentId) {
		instrumentService.deleteInstrument(instrumentId);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/sync/{ticker}")
	public ResponseEntity<InstrumentResponse> syncInstrumentFromExternalApi(@PathVariable String ticker) {
		// TODO: Keep this endpoint wired so frontend can call it later.
		// TODO: Once data provider API is ready, service will fetch and upsert data.
		Instrument synced = instrumentService.createOrUpdateFromExternalData(ticker);
		return ResponseEntity.ok(toResponse(synced));
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
