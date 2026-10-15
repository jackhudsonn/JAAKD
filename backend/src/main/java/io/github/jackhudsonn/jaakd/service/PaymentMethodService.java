package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreatePaymentMethodRequest;
import io.github.jackhudsonn.jaakd.exception.PaymentMethodNotFoundException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.PaymentMethod;
import io.github.jackhudsonn.jaakd.repository.PaymentMethodRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PaymentMethodService {

    private static final Set<String> ALLOWED_ACCOUNT_TYPES = Set.of("checking", "savings");
    private final PaymentMethodRepository paymentMethodRepository;
    private final CurrentUserService currentUserService;

    public PaymentMethodService(PaymentMethodRepository paymentMethodRepository, CurrentUserService currentUserService) {
        this.paymentMethodRepository = paymentMethodRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public List<PaymentMethod> listCurrentUserMethods() {
        UUID userId = currentUserService.getUserId();
        return paymentMethodRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public PaymentMethod createCurrentUserMethod(CreatePaymentMethodRequest request) {
        UUID userId = currentUserService.getUserId();

        String accountType = normalizeAccountType(request.accountType());
        PaymentMethod paymentMethod = new PaymentMethod(
            userId,
            request.nickname().trim(),
            request.accountHolderName().trim(),
            request.bankName().trim(),
            accountType,
            request.routingNumber(),
            request.accountNumber()
        );

        return paymentMethodRepository.save(paymentMethod);
    }

    @Transactional
    public void deleteCurrentUserMethod(UUID paymentMethodId) {
        UUID userId = currentUserService.getUserId();
        PaymentMethod paymentMethod = paymentMethodRepository.findByPaymentMethodIdAndUserId(paymentMethodId, userId)
            .orElseThrow(() -> new PaymentMethodNotFoundException(paymentMethodId));

        paymentMethodRepository.delete(paymentMethod);
    }

    private String normalizeAccountType(String accountTypeRaw) {
        String normalized = accountTypeRaw == null ? "" : accountTypeRaw.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_ACCOUNT_TYPES.contains(normalized)) {
            throw new ValidationException("accountType must be one of: checking, savings");
        }
        return normalized;
    }
}
