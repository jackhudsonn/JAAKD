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
  registrationId: string;
}

export interface ChallengeResponse {
  challenge: string;
  continuation: string;
}

export type RegistrationResult =
  | { status: 'registered'; email: string; registrationId: string }
  | { status: 'confirmation_required'; email: string; registrationId: string };

export type LoginResult =
  | { status: 'authenticated'; email: string }
  | { status: 'challenge'; challenge: string; continuation: string };
