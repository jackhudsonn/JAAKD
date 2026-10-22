import { Injectable } from '@angular/core';

// Remembers which pending registration belongs to an email so confirmation can
// resume after a reload. The registration ID is an opaque UUID, not a secret.
@Injectable({
  providedIn: 'root',
})
export class RegistrationContinuationService {
  private readonly keyPrefix = 'jaakd.registration.';

  remember(email: string, registrationId: string): void {
    try {
      globalThis.sessionStorage?.setItem(this.key(email), registrationId);
    } catch {
      // Storage is optional; the confirm URL still carries the ID.
    }
  }

  peek(email: string): string | null {
    try {
      return globalThis.sessionStorage?.getItem(this.key(email)) ?? null;
    } catch {
      return null;
    }
  }

  take(email: string): string | null {
    const registrationId = this.peek(email);
    this.clear(email);
    return registrationId;
  }

  clear(email: string): void {
    try {
      globalThis.sessionStorage?.removeItem(this.key(email));
    } catch {
      // Best effort; stale state only affects convenience, not security.
    }
  }

  private key(email: string): string {
    return `${this.keyPrefix}${email.trim().toLowerCase()}`;
  }
}
