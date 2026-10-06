import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AUTH_FLOW } from '@core/http/auth-flow.token';
import { Observable, catchError, throwError } from 'rxjs';

// The session cookie is the only credential, so every request is sent with
// credentials. A 401 on a protected request means the session is gone: clear
// state and send the user to sign in. A 403 means signed in but not allowed,
// which each screen handles itself. Sign-in-flow requests opt out of the
// redirect with AUTH_FLOW and surface the error where it was raised.
export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const outgoingRequest = request.clone({ withCredentials: true });

  return next(outgoingRequest).pipe(
    catchError((error: unknown) => {
      const surfacedByCaller = request.context.get(AUTH_FLOW);

      if (error instanceof HttpErrorResponse && error.status === 401 && !surfacedByCaller) {
        authService.clearSession();
        void router.navigate(['/auth/login']);
      }

      return throwError(() => error);
    }),
  );
};
