package io.github.jackhudsonn.jaakd.service;

public class ValidaitonService {
    
    // Listen to order submission events from Kafka
    // already have OrderLog with status SUBMITTED
    // Need Kafka to trigger validation process for each submitted order

    // Run validation against business rules
    // (Kafka looks for CANCELLED Orders and triggers the cancellation process)
    // enough cash available for buy orders
    // sufficient holdings for sell orders
    // set order status to VALIDATED if all checks pass
    // set order status to REJECTED if any check fails

    // once Validated, do one final check to get AGREED price 
    // Call FifoAccountingService to execute and have executed price
    

}
