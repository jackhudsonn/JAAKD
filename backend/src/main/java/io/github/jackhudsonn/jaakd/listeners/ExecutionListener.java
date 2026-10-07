package io.github.jackhudsonn.jaakd.listeners;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.service.ExecutionService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ExecutionListener {

    private final ExecutionService executionService;

    public ExecutionListener(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @KafkaListener(topics = KafkaTopics.ORDER_ACCEPTED, groupId = "jaakd-execution")
    public void onOrderAccepted(OrderAcceptedEvent event) {
        executionService.handleOrderAccepted(event);
    }
}
