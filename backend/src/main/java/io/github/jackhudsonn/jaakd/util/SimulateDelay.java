package io.github.jackhudsonn.jaakd.util;

import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

@Component
public class SimulateDelay {

	private static final long MIN_DELAY_MILLIS = 2000;
	private static final long MAX_DELAY_MILLIS = 3000;

	public void simulateMarketActivityDelay() throws InterruptedException {
		long delayMillis = ThreadLocalRandom.current().nextLong(MIN_DELAY_MILLIS, MAX_DELAY_MILLIS + 1);
		Thread.sleep(delayMillis);
	}
}
