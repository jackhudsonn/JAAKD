import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RegistrationContinuationService } from '@core/services/registration-continuation.service';
import {
  LocationDataService,
  CountryOption,
} from '@features/profile/services/location-data.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';

import {
  getLatestEligibleDob,
  isAtLeast18,
  isValidPostalCode,
} from '@shared/utils/profile-validation';
import { ToastService } from '@shared/components/toast/toast.service';
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly toastService = inject(ToastService);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  showPassword = false;
  showConfirmPassword = false;
  confirmPassword = '';
  dob = '';
  city = '';
  state = '';
  country = '';
  zipCode = '';
  countries = signal<CountryOption[]>([]);
  states = signal<string[]>([]);
  cities = signal<string[]>([]);

  countryCode = '';
  get maxDob() {
    return getLatestEligibleDob();
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private registrationContinuation: RegistrationContinuationService,
    private locationDataService: LocationDataService,
  ) {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    void this.loadCountries();
  }
  private async loadCountries() {
    this.countries.set(await this.locationDataService.getCountries());
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onCountryChange() {
    this.states.set(await this.locationDataService.getStates(this.countryCode));

    this.state = '';
    this.city = '';
    this.cities.set([]);

    const selectedCountry = this.countries().find(
      (country) => country.code === this.countryCode,
    );

    this.country = selectedCountry?.name ?? '';
  }

  async onStateChange() {
    this.city = '';

    this.cities.set(await this.locationDataService.getCities(this.countryCode, this.state));
  }

  async signUp() {
    if (
      !this.firstName ||
      !this.lastName ||
      !this.email ||
      !this.password ||
      !this.dob ||
      !this.country ||
      !this.state ||
      !this.city ||
      !this.zipCode
    ) {
      this.toastService.error('Please complete all required fields.');
      return;
    }

    if (this.password.length < 6) {
      this.toastService.error('Password must be at least 6 characters.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.toastService.error('Passwords do not match.');
      return;
    }
    if (!isAtLeast18(this.dob)) {
      this.toastService.error('You must be at least 18 years old to create an account.');
      return;
    }

    if (!isValidPostalCode(this.countryCode, this.zipCode)) {
      this.toastService.error('Enter a valid ZIP / postal code.');
      return;
    }

    try {
      const result = await this.authService.register({
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        dob: this.dob,
        city: this.city,
        state: this.state,
        country: this.country,
        zipCode: this.zipCode,
      });

      if (result.status !== 'registered') {
        this.registrationContinuation.remember(result.email, result.registrationId);
        this.toastService.success('Account created. Check your email for a confirmation code.');
        await this.router.navigate(['/auth/confirm'], {
          queryParams: { registrationId: result.registrationId, email: result.email },
        });
        return;
      }

      await this.authService.login(this.email, this.password);
      this.toastService.success('Account created successfully.');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.toastService.error('An account with this email already exists. Please sign in.');
        return;
      }

      this.toastService.error(this.mapErrorToMessage(error));
    }
  }

  private mapErrorToMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to create your account right now. Please try again.';
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    const detailedMessage = toUserFacingErrorMessage(response);
    if (detailedMessage) {
      return detailedMessage;
    }

    return 'Unable to create your account right now. Please try again.';
  }
}
