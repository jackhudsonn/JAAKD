import { Component, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CountryOption, LocationDataService } from '@core/services/location-data.service';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import {
  CreateProfileRequest,
  ErrorResponse,
  Profile,
  toUserFacingErrorMessage,
  UpdateProfileRequest,
} from '@core/models/profile.model';

import {
  getLatestEligibleDob,
  isAtLeast18,
  isValidPostalCode,
} from '@shared/utils/profile-validation';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  profile = signal<Profile | null>(null);
  isProfileMissing = signal(false);
  displayName = computed(() => {
    const currentProfile = this.profile();
    if (!currentProfile) {
      return null;
    }

    return (
      [currentProfile.firstName, currentProfile.lastName].filter(Boolean).join(' ').trim() || null
    );
  });
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
    protected authService: AuthService,
    private profileService: ProfileService,
    private locationDataService: LocationDataService,
  ) {
    void this.loadCountries();
  }
  private async loadCountries() {
    this.countries = await this.locationDataService.getCountries();
  }

  async ngOnInit() {
    await this.loadProfile();
  }

  private async loadProfile() {
    try {
      const currentProfile = await this.profileService.getCurrentProfile();
      this.profile.set(currentProfile);
      this.isProfileMissing.set(false);
      this.populateEditableFields(currentProfile);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.isProfileMissing.set(true);
        this.editing.set(true);
        this.profileMessage.set('Complete your profile to continue.');
        return;
      }

      this.profileMessage.set(this.mapErrorToMessage(error));
    }
  }

  async loadEditableProfile() {
    const currentProfile = this.profile();
    if (!currentProfile && !this.isProfileMissing()) {
      return;
    }

    if (currentProfile) {
      this.populateEditableFields(currentProfile);
    }

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

    const payload: CreateProfileRequest & UpdateProfileRequest = {
      firstName: this.firstName,
      lastName: this.lastName,
      dob: this.dob,
      city: this.city,
      state: this.state,
      country: this.country,
      zipCode: this.zipCode,
    };

    try {
      const updatedProfile = this.isProfileMissing()
        ? await this.profileService.createCurrentProfile(payload)
        : await this.profileService.updateCurrentProfile(payload);

      this.profile.set(updatedProfile);
      this.isProfileMissing.set(false);
      this.profileMessage.set('Profile updated.');
      this.editing.set(false);
    } catch (error) {
      this.profileMessage.set(this.mapErrorToMessage(error));
    }
  }

  private populateEditableFields(currentProfile: Profile) {
    this.firstName = currentProfile.firstName ?? '';
    this.lastName = currentProfile.lastName ?? '';
    this.dob = currentProfile.dob ?? '';
    this.city = currentProfile.city ?? '';
    this.state = currentProfile.state ?? '';
    this.country = currentProfile.country ?? '';
    this.zipCode = currentProfile.zipCode ?? '';
  }

  private mapErrorToMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to load or update your profile right now. Please try again.';
    }

    const response = error.error as Partial<ErrorResponse> | undefined;
    const detailedMessage = toUserFacingErrorMessage(response);
    if (detailedMessage) {
      return detailedMessage;
    }

    return 'Unable to load or update your profile right now. Please try again.';
  }
}
