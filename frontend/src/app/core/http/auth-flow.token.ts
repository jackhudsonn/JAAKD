import { HttpContextToken } from '@angular/common/http';

// Marks a request as part of the credential flow (login, register, session
// probe, logout, change-password). A 401 from these is a normal response the
// calling screen renders inline (bad credentials, wrong current password), so
// the interceptor must not treat it as an expired session and redirect.
export const AUTH_FLOW = new HttpContextToken<boolean>(() => false);
