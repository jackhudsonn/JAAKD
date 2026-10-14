package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreatePaymentMethodRequest;
import io.github.jackhudsonn.jaakd.dto.PaymentMethodResponse;
import io.github.jackhudsonn.jaakd.model.PaymentMethod;
import io.github.jackhudsonn.jaakd.service.PaymentMethodService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment-methods")
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    public PaymentMethodController(PaymentMethodService paymentMethodService) {
        this.paymentMethodService = paymentMethodService;
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<PaymentMethodResponse> listCurrentUserMethods() {
        return paymentMethodService.listCurrentUserMethods().stream()
            .map(this::toResponse)
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentMethodResponse createCurrentUserMethod(@Valid @RequestBody CreatePaymentMethodRequest request) {
        PaymentMethod created = paymentMethodService.createCurrentUserMethod(request);
        return toResponse(created);
    }

    @DeleteMapping("/{paymentMethodId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCurrentUserMethod(@PathVariable UUID paymentMethodId) {
        paymentMethodService.deleteCurrentUserMethod(paymentMethodId);
    }

    private PaymentMethodResponse toResponse(PaymentMethod paymentMethod) {
        return new PaymentMethodResponse(
            paymentMethod.getPaymentMethodId(),
            paymentMethod.getNickname(),
            paymentMethod.getAccountHolderName(),
            paymentMethod.getBankName(),
            paymentMethod.getAccountType(),
            maskLast4(paymentMethod.getRoutingNumber()),
            maskLast4(paymentMethod.getAccountNumber()),
            paymentMethod.getCreatedAt(),
            paymentMethod.getUpdatedAt()
        );
    }

    private String maskLast4(String value) {
        final int NON_MASKED_LENGTH = 4;
        
        if (value == null || value.length() < NON_MASKED_LENGTH) {
            return "";
        }

        return value.substring(value.length() - NON_MASKED_LENGTH);
    }
}
