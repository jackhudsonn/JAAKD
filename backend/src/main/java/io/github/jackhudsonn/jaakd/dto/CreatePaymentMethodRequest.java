package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreatePaymentMethodRequest(
    @NotBlank(message = "nickname is required")
    String nickname,

    @NotBlank(message = "accountHolderName is required")
    String accountHolderName,

    @NotBlank(message = "bankName is required")
    String bankName,

    @NotBlank(message = "accountType is required")
    String accountType,

    @NotBlank(message = "routingNumber is required")
    @Pattern(regexp = "^\\d{9}$", message = "routingNumber must be exactly 9 digits")
    String routingNumber,

    @NotBlank(message = "accountNumber is required")
    @Pattern(regexp = "^\\d{4,17}$", message = "accountNumber must be 4 to 17 digits")
    String accountNumber
) {
}
