export function isValidPostalCode(countryCode: string, postalCode: string): boolean {
  const value = postalCode.trim();

  if (!value) {
    return false;
  }

  const patterns: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    IN: /^\d{6}$/,
  };

  const pattern = patterns[countryCode];

  return pattern ? pattern.test(value) : value.length >= 3;
}

export function isAtLeast18(dob: string): boolean {
  if (!dob) {
    return false;
  }

  const [year, month, day] = dob.split('-').map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const birthDate = new Date(year, month - 1, day);

  const today = new Date();

  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

  return birthDate <= cutoff;
}

export function getLatestEligibleDob(): string {
  const today = new Date();

  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, '0');
  const day = String(cutoff.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
