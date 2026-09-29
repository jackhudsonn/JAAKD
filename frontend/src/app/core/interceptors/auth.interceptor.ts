import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@environments/environment.local';
import { AuthService } from '@core/services/auth.service';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

function shouldAttachAccessToken(request: HttpRequest<unknown>): boolean {
  if (request.url.startsWith(environment.apiUrl)) {
    return true;
  }

  return request.url.startsWith(`${environment.authUrl}/auth/change-password`);
}

function shouldAttemptRefresh(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith(environment.apiUrl) && !request.headers.has('x-jaakd-retried');
}

function withBearerToken(
  request: HttpRequest<unknown>,
  token: string | null,
): HttpRequest<unknown> {
  if (!token) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const outgoingRequest = shouldAttachAccessToken(request)
    ? withBearerToken(request, authService.getAccessToken())
    : request;

  return next(outgoingRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !shouldAttemptRefresh(outgoingRequest)
      ) {
        return throwError(() => error);
      }

      return from(authService.refresh()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            return from(
              authService.logout().then(async () => {
                await router.navigate(['/auth/login']);
                throw error;
              }),
            );
          }

          const retriedRequest = withBearerToken(
            outgoingRequest.clone({
              setHeaders: {
                'x-jaakd-retried': 'true',
              },
            }),
            authService.getAccessToken(),
          );

          return next(retriedRequest);
        }),
      );
    }),
  );
};
