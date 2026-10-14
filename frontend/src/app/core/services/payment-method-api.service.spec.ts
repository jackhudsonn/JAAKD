import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentMethodApiService } from './payment-method-api.service';
import { environment } from '@environments/environment.local';

describe('PaymentMethodApiService', () => {
  let service: PaymentMethodApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PaymentMethodApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PaymentMethodApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('list sends GET /api/payment-methods', async () => {
    const promise = service.list();

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/payment-methods`);
    expect(req.request.method).toBe('GET');
    req.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('create sends POST /api/payment-methods', async () => {
    const payload = {
      nickname: 'Main checking',
      accountHolderName: 'Joanna Smith',
      bankName: 'Example National',
      accountType: 'checking' as const,
      routingNumber: '123456789',
      accountNumber: '12345678',
    };

    const promise = service.create(payload);

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/payment-methods`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      paymentMethodId: 'pm-1',
      nickname: payload.nickname,
      accountHolderName: payload.accountHolderName,
      bankName: payload.bankName,
      accountType: payload.accountType,
      routingLast4: '6789',
      accountLast4: '5678',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(promise).resolves.toEqual({
      paymentMethodId: 'pm-1',
      nickname: payload.nickname,
      accountHolderName: payload.accountHolderName,
      bankName: payload.bankName,
      accountType: payload.accountType,
      routingLast4: '6789',
      accountLast4: '5678',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('remove sends DELETE /api/payment-methods/:id', async () => {
    const promise = service.remove('pm-1');

    const req = httpTestingController.expectOne(`${environment.apiUrl}/api/payment-methods/pm-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await expect(promise).resolves.toBeNull();
  });
});
