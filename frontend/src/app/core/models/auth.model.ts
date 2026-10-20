export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dob?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
}

export interface RegistrationResponse {
  status: 'REGISTERED' | 'CONFIRMATION_REQUIRED';
  email: string;
}

export interface EmailConfirmationResponse {
  challenge: 'EMAIL_CONFIRMATION';
  email: string;
}

export interface ChallengeResponse {
  challenge: string;
  continuation: string;
}

export type RegistrationResult =
  | { status: 'registered'; email: string }
  | { status: 'confirmation_required'; email: string }
  | { status: 'confirmation_pending'; email: string };

export type LoginResult =
  | { status: 'authenticated'; email: string }
  | { status: 'challenge'; challenge: string; continuation: string };
