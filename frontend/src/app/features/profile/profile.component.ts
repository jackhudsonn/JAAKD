import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/services/supabase.service';
import { CountryOption, LocationDataService } from '../../core/services/location-data.service';

import {
  getLatestEligibleDob,
  isAtLeast18,
  isValidPostalCode,
} from '../../shared/utils/profile-validation';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  user = signal<User | null>(null);
  displayName = signal<string | null>(null);
  resetMessage = signal('');
  resetLoading = signal(false);
  editing = signal(false);
  profileMessage = signal('');

  firstName = '';
  lastName = '';
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

  constructor(
    private supabaseService: SupabaseService,
    private locationDataService: LocationDataService,
  ) {
    void this.loadCountries();
  }
  private async loadCountries() {
    this.countries = await this.locationDataService.getCountries();
  }

  async ngOnInit() {
    const { data } = await this.supabaseService.getSession();
    await this.setSessionUser(data.session?.user ?? null);
  }

  async setSessionUser(user: User | null) {
    this.user.set(user);

    if (!user) {
      this.displayName.set(null);
      return;
    }

    // Use Auth metadata immediately so the email does not flash first.
    const metadataFirstName = user.user_metadata?.['first_name'];
    const metadataLastName = user.user_metadata?.['last_name'];

    const metadataName = [metadataFirstName, metadataLastName].filter(Boolean).join(' ').trim();

    this.displayName.set(metadataName || null);

    // Then confirm/override with the profile stored in Postgres.
    const { data } = await this.supabaseService.getProfile(user.id);

    const profileName = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim();

    if (profileName) {
      this.displayName.set(profileName);
    }
  }

  get metadata() {
    return this.user()?.user_metadata ?? {};
  }
  async loadEditableProfile() {
    const metadata = this.metadata;

    this.firstName = metadata['first_name'] ?? '';
    this.lastName = metadata['last_name'] ?? '';
    this.dob = metadata['dob'] ?? '';
    this.city = metadata['city'] ?? '';
    this.state = metadata['state'] ?? '';
    this.country = metadata['country'] ?? '';
    this.zipCode = metadata['zip_code'] ?? '';

    const selectedCountry = this.countries.find(
      (countryOption) => countryOption.name === this.country || countryOption.code === this.country,
    );

    this.countryCode = selectedCountry?.code ?? '';

    if (this.countryCode) {
      this.states = await this.locationDataService.getStates(this.countryCode);
    }

    if (this.countryCode && this.state) {
      this.cities = await this.locationDataService.getCities(this.countryCode, this.state);
    }
  }
  async startEditing() {
    await this.loadEditableProfile();

    this.profileMessage.set('');
    this.editing.set(true);
  }

  async cancelEditing() {
    await this.loadEditableProfile();
    this.profileMessage.set('');
    this.editing.set(false);
  }
  async onCountryChange() {
    this.states = await this.locationDataService.getStates(this.countryCode);
    this.state = '';
    this.city = '';
    this.cities = [];

    const selectedCountry = this.countries.find(
      (countryOption) => countryOption.code === this.countryCode,
    );

    this.country = selectedCountry?.name ?? '';
  }

  async onStateChange() {
    this.city = '';

    this.cities = await this.locationDataService.getCities(this.countryCode, this.state);
  }
  async saveProfile() {
    if (
      !this.firstName ||
      !this.lastName ||
      !this.dob ||
      !this.country ||
      !this.state ||
      !this.city ||
      !this.zipCode
    ) {
      this.profileMessage.set('Please complete all required fields.');
      return;
    }

    if (!isAtLeast18(this.dob)) {
      this.profileMessage.set('Account holders must be at least 18 years old.');
      return;
    }

    if (!isValidPostalCode(this.countryCode, this.zipCode)) {
      this.profileMessage.set('Enter a valid ZIP / postal code.');
      return;
    }

    const { data, error } = await this.supabaseService.updateProfileMetadata({
      firstName: this.firstName,
      lastName: this.lastName,
      dob: this.dob,
      city: this.city,
      state: this.state,
      country: this.country,
      zipCode: this.zipCode,
    });

    if (error) {
      this.profileMessage.set('Unable to update profile. Please try again.');
      return;
    }

    this.user.set(data.user);

    this.displayName.set([this.firstName, this.lastName].filter(Boolean).join(' '));

    this.profileMessage.set('Profile updated.');
    this.editing.set(false);
  }
  async resetPassword() {
    const email = this.user()?.email;

    if (!email) {
      this.resetMessage.set('Unable to find an email for this account.');
      return;
    }

    this.resetLoading.set(true);
    this.resetMessage.set('');

    const redirectTo = `${window.location.origin}/auth/update-password`;

    const { error } = await this.supabaseService.sendPasswordReset(email, redirectTo);

    this.resetLoading.set(false);

    if (error) {
      if (error.status === 429) {
        this.resetMessage.set('Please wait about a minute before requesting another reset email.');
      } else {
        this.resetMessage.set('Unable to send reset instructions. Please try again.');
      }

      return;
    }

    this.resetMessage.set('Password reset instructions were sent to your email.');
  }
}
