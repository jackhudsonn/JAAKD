package io.github.jackhudsonn.jaakd.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
@EnableConfigurationProperties(FauxnanceProperties.class)
public class FauxnanceClientConfig {

    @Bean
    public RestTemplate fauxnanceRestTemplate(FauxnanceProperties fauxnanceProperties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) fauxnanceProperties.getTimeout().getConnect().toMillis());
        requestFactory.setReadTimeout((int) fauxnanceProperties.getTimeout().getRead().toMillis());

        return new RestTemplate(requestFactory);
    }
}
