import { RegistrationContinuationService } from './registration-continuation.service';

describe('RegistrationContinuationService', () => {
  let service: RegistrationContinuationService;

  beforeEach(() => {
    service = new RegistrationContinuationService();
    sessionStorage.clear();
  });

  it('remembers and returns a registration ID by email', () => {
    service.remember('Joanna@Example.com', 'registration-1');

    expect(service.peek('joanna@example.com')).toBe('registration-1');
  });

  it('returns and clears the registration ID once', () => {
    service.remember('joanna@example.com', 'registration-1');

    expect(service.take('joanna@example.com')).toBe('registration-1');
    expect(service.peek('joanna@example.com')).toBeNull();
  });

  it('clears a stored registration ID', () => {
    service.remember('joanna@example.com', 'registration-1');

    service.clear('JOANNA@example.com');

    expect(service.peek('joanna@example.com')).toBeNull();
  });
});
