package io.github.jackhudsonn.jaakd.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfiguration {

    @Bean
    public NewTopic orderSubmittedTopic() {
        return TopicBuilder.name(KafkaTopics.ORDER_SUBMITTED)
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic orderAcceptedTopic() {
        return TopicBuilder.name(KafkaTopics.ORDER_ACCEPTED)
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic orderRejectedTopic() {
        return TopicBuilder.name(KafkaTopics.ORDER_REJECTED)
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic orderExecutedTopic() {
        return TopicBuilder.name(KafkaTopics.ORDER_EXECUTED)
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic orderFailedTopic() {
        return TopicBuilder.name(KafkaTopics.ORDER_FAILED)
            .partitions(3)
            .replicas(1)
            .build();
    }
}
