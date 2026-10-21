package io.github.jackhudsonn.jaakd.identity;

// What the provider returns after creating a credential. `subject` is the
// provider's identity for the new user, stored in the adapter-owned link
// table. `confirmationRequired` is false for providers without an email step.
// `signUpSession` is a short-lived provider session that can complete sign-in
// after confirmation; it is null when the provider has no such flow.
public record RegistrationOutcome(String subject, boolean confirmationRequired, String signUpSession) {
}
