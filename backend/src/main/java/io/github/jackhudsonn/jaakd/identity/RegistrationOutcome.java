package io.github.jackhudsonn.jaakd.identity;

// What the provider returns after creating a credential. `subject` is the
// provider's identity for the new user, stored in the adapter-owned link
// table. `confirmationRequired` is false for providers without an email step.
public record RegistrationOutcome(String subject, boolean confirmationRequired) {
}
