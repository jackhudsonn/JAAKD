package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CreatePaymentMethodRequest;
import io.github.jackhudsonn.jaakd.exception.PaymentMethodNotFoundException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.PaymentMethod;
import io.github.jackhudsonn.jaakd.repository.PaymentMethodRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentMethodServiceTest {

    @Mock
    private PaymentMethodRepository paymentMethodRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private PaymentMethodService paymentMethodService;

    @Test
    void createCurrentUserMethod_happyPath_normalizesInputAndSaves() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getUserId()).thenReturn(userId);
        when(paymentMethodRepository.save(any(PaymentMethod.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        PaymentMethod created = paymentMethodService.createCurrentUserMethod(new CreatePaymentMethodRequest(
            " Main checking ",
            " Joanna Smith ",
            " Example Bank ",
            "SAVINGS",
            "123456789",
            "12345678"
        ));

        assertEquals(userId, created.getUserId());
        assertEquals("Main checking", created.getNickname());
        assertEquals("Joanna Smith", created.getAccountHolderName());
        assertEquals("Example Bank", created.getBankName());
        assertEquals("savings", created.getAccountType());
        assertEquals("123456789", created.getRoutingNumber());
        assertEquals("12345678", created.getAccountNumber());
    }

    @Test
    void createCurrentUserMethod_invalidAccountType_throwsValidationError() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getUserId()).thenReturn(userId);

        assertThrows(ValidationException.class, () -> paymentMethodService.createCurrentUserMethod(
            new CreatePaymentMethodRequest(
                "Main",
                "Joanna Smith",
                "Example Bank",
                "business",
                "123456789",
                "12345678"
            )
        ));

        verify(paymentMethodRepository, never()).save(any(PaymentMethod.class));
    }

    @Test
    void deleteCurrentUserMethod_missingForUser_throwsNotFound() {
        UUID userId = UUID.randomUUID();
        UUID paymentMethodId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(paymentMethodRepository.findByPaymentMethodIdAndUserId(paymentMethodId, userId))
            .thenReturn(Optional.empty());

        assertThrows(
            PaymentMethodNotFoundException.class,
            () -> paymentMethodService.deleteCurrentUserMethod(paymentMethodId)
        );
        verify(paymentMethodRepository, never()).delete(any(PaymentMethod.class));
    }
}
