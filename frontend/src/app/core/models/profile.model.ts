export interface Profile {
  userId: string;
  email: string;
  userType: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  dob: string | null;
  avatar: string | null;
}

export interface CreateProfileRequest {
  firstName: string;
  lastName: string;
  dob?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  dob?: string | null;
  avatar?: string | null;
}

export interface ErrorResponse {
  timestamp: string;
  message: string;
  details: Record<string, string>;
}

export function toUserFacingErrorMessage(errorResponse?: Partial<ErrorResponse>): string | null {
  if (!errorResponse) {
    return null;
  }

  const detailMessages = Object.values(errorResponse.details ?? {})
    .map((message) => message?.trim())
    .filter((message): message is string => Boolean(message));

  if (detailMessages.length > 0) {
    return detailMessages.join(' ');
  }

  const topLevelMessage = errorResponse.message?.trim();
  return topLevelMessage ? topLevelMessage : null;
}
