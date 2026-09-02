import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { LocationDataService, CountryOption } from '../../../core/services/location-data.service';

import {
  getLatestEligibleDob,
  isAtLeast18,
  isValidPostalCode,
} from '../../../shared/utils/profile-validation';
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
    private supabaseService: SupabaseService,
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

    if (this.password.length < 6) {
      this.message.set('Password must be at least 6 characters.');
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

    const { data, error } = await this.supabaseService.signUp(this.email, this.password, {
      firstName: this.firstName,
      lastName: this.lastName,
      dob: this.dob,
      city: this.city,
      state: this.state,
      country: this.country,
      zipCode: this.zipCode,
    });

    if (error) {
      this.message.set(error.message);
      return;
    }

    if (data.session) {
      await this.router.navigate(['/dashboard']);
    } else {
      this.message.set('Account created. Check your email to confirm your account.');
    }
  }
}
