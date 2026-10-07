package io.github.jackhudsonn.jaakd.listeners;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent;
import io.github.jackhudsonn.jaakd.service.ValidationService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ValidationListener {

    private final ValidationService validationService;

    public ValidationListener(ValidationService validationService) {
        this.validationService = validationService;
    }

    @KafkaListener(topics = KafkaTopics.ORDER_SUBMITTED, groupId = "jaakd-validation")
    public void onOrderSubmitted(OrderSubmittedEvent event) {
        validationService.handleOrderSubmitted(event);
    }
}
