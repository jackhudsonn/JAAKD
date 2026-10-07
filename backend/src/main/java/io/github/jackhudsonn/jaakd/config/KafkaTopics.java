package io.github.jackhudsonn.jaakd.config;

public final class KafkaTopics {
    public static final String ORDER_SUBMITTED = "order-submitted";
    public static final String ORDER_ACCEPTED = "order-accepted";
    public static final String ORDER_REJECTED = "order-rejected";
    public static final String ORDER_EXECUTED = "order-executed";
    public static final String ORDER_FAILED = "order-failed";

    private KafkaTopics() {
    }
}
