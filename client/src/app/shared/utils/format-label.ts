/**
 * Turns a snake_case identifier (e.g. status/method values from the API)
 * into a human-readable label, e.g. "bank_transfer" -> "Bank Transfer".
 */
export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
