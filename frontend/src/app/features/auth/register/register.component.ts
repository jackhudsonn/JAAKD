import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LocationDataService, CountryOption } from '@core/services/location-data.service';
import { ProfileService } from '@core/services/profile.service';
import { ErrorResponse, toUserFacingErrorMessage } from '@core/models/profile.model';

import {
  getLatestEligibleDob,
  isAtLeast18,
  isValidPostalCode,
} from '@shared/utils/profile-validation';
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
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
  countries: CountryOption[] = [];
  states: string[] = [];
  cities: string[] = [];

  countryCode = '';
  get maxDob() {
    return getLatestEligibleDob();
  }

  message = signal('');

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private locationDataService: LocationDataService,
  ) {
    void this.loadCountries();
  }
  private async loadCountries() {
    this.countries = await this.locationDataService.getCountries();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
  async onCountryChange() {
    this.states = await this.locationDataService.getStates(this.countryCode);

    this.state = '';
    this.city = '';
    this.cities = [];

    const selectedCountry = this.countries.find((country) => country.code === this.countryCode);

    this.country = selectedCountry?.name ?? '';
  }

  async onStateChange() {
    this.city = '';

    this.cities = await this.locationDataService.getCities(this.countryCode, this.state);
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
      this.message.set('Please complete all required fields.');
      return;
    }

    if (this.password.length < 8) {
      this.message.set('Password must be at least 8 characters.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.message.set('Passwords do not match.');
      return;
    }
    if (!isAtLeast18(this.dob)) {
      this.message.set('You must be at least 18 years old to create an account.');
      return;
    }

    if (!isValidPostalCode(this.countryCode, this.zipCode)) {
      this.message.set('Enter a valid ZIP / postal code.');
      return;
    }

    let registered = false;

    try {
      await this.authService.register(this.email, this.password);
      registered = true;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
        this.message.set(this.mapErrorToMessage(error));
        return;
      }
    }

    try {
      await this.authService.login(this.email, this.password);
    } catch (error) {
      this.message.set(registered ? this.mapErrorToMessage(error) : 'An account with this email already exists. Please sign in with your existing password.');
      return;
    }

    try {
      await this.profileService.getCurrentProfile();
      this.message.set('');
      await this.router.navigate(['/dashboard']);
      return;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        if (registered) {
          try {
            await this.profileService.createCurrentProfile({
              firstName: this.firstName,
              lastName: this.lastName,
              dob: this.dob,
              city: this.city,
              state: this.state,
              country: this.country,
              zipCode: this.zipCode,
            });

            this.message.set('');
            await this.router.navigate(['/dashboard']);
          } catch (createError) {
            this.message.set(this.mapErrorToMessage(createError));
          }
          return;
        }

        this.message.set('Please complete your profile to continue.');
        await this.router.navigate(['/profile']);
        return;
      }

      this.message.set(this.mapErrorToMessage(error));
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
