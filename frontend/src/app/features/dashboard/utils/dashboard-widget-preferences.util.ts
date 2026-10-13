import { WidgetId } from '../components/widget-selector/widget-selector.component';

export function sanitizeDashboardWidgetIds(
  input: readonly unknown[] | null | undefined,
  allowedOrder: readonly WidgetId[],
  defaultOrder: readonly WidgetId[],
  minCount = 2,
): WidgetId[] {
  const raw = Array.isArray(input) ? input : [];
  const normalized: WidgetId[] = [];
  const seen = new Set<WidgetId>();
  const allowedSet = new Set<WidgetId>(allowedOrder);
  const numericMode = shouldUseOneBasedNumericMode(raw, allowedOrder.length);

  for (const value of raw) {
    const candidate = normalizeCandidate(value, allowedOrder, numericMode);
    if (!candidate || !allowedSet.has(candidate) || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  for (const fallback of defaultOrder) {
    if (normalized.length >= minCount) {
      break;
    }

    if (!seen.has(fallback)) {
      seen.add(fallback);
      normalized.push(fallback);
    }
  }

  if (normalized.length === 0) {
    return [...defaultOrder];
  }

  return normalized;
}

function shouldUseOneBasedNumericMode(values: readonly unknown[], max: number): boolean {
  if (values.length === 0) {
    return false;
  }

  let sawNumeric = false;

  for (const value of values) {
    const parsed = parseInteger(value);
    if (parsed === null) {
      return false;
    }

    sawNumeric = true;
    if (parsed < 1 || parsed > max) {
      return false;
    }
  }

  return sawNumeric;
}

function normalizeCandidate(
  value: unknown,
  allowedOrder: readonly WidgetId[],
  numericMode: boolean,
): WidgetId | null {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) {
      return null;
    }

    if (numericMode) {
      const numeric = parseInteger(trimmed);
      if (numeric === null || numeric < 1 || numeric > allowedOrder.length) {
        return null;
      }

      return allowedOrder[numeric - 1] ?? null;
    }

    return trimmed as WidgetId;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    if (numericMode) {
      if (value < 1 || value > allowedOrder.length) {
        return null;
      }
      return allowedOrder[value - 1] ?? null;
    }

    if (value >= 0 && value < allowedOrder.length) {
      return allowedOrder[value] ?? null;
    }
  }

  return null;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
}