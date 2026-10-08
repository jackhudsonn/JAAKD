import { Injectable } from '@angular/core';
import {
  getCountries,
  getStatesOfCountry,
  getCitiesOfState,
} from '@countrystatecity/countries-browser';

export interface CountryOption {
  code: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationDataService {
  async getCountries(): Promise<CountryOption[]> {
    const countries = await getCountries();

    return countries.map((country) => ({
      code: country.iso2,
      name: country.name,
    }));
  }

  async getStates(countryCode: string): Promise<string[]> {
    const states = await getStatesOfCountry(countryCode);

    return states.map((state) => state.name);
  }

  async getCities(countryCode: string, stateName: string): Promise<string[]> {
    const states = await getStatesOfCountry(countryCode);

    const selectedState = states.find((state) => state.name === stateName);

    if (!selectedState) {
      return [];
    }

    const cities = await getCitiesOfState(countryCode, selectedState.iso2);

    return cities.map((city) => city.name);
  }
}
