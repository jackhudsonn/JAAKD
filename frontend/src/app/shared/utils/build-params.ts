import { HttpParams } from '@angular/common/http';

/**
 * Builds query params from an options object, skipping undefined, null, false, and blank values.
 * Strings are trimmed; numbers (including 0) and `true` are sent as-is.
 */
export function buildParams(values?: object): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        params = params.set(key, trimmed);
      }
    } else if (typeof value === 'number' || value === true) {
      params = params.set(key, value);
    }
  }

  return params;
}
