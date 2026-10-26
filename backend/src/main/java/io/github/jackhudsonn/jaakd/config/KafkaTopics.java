package io.github.jackhudsonn.jaakd.config;

public final class KafkaTopics {
    public static final String ORDER_SUBMITTED = "jaakd-order-submitted";
    public static final String ORDER_ACCEPTED = "jaakd-order-accepted";
    public static final String ORDER_REJECTED = "jaakd-order-rejected";
    public static final String ORDER_EXECUTED = "jaakd-order-executed";
    public static final String ORDER_FAILED = "jaakd-order-failed";

    private KafkaTopics() {
    }
}
