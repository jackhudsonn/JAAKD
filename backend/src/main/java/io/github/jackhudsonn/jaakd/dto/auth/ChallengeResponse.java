package io.github.jackhudsonn.jaakd.dto.auth;

// 202 response when the identity provider requires another authentication
// step. The continuation is opaque to the client.
public record ChallengeResponse(String challenge, String continuation) {
}
