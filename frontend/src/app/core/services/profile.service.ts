import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreateProfileRequest, Profile, UpdateProfileRequest } from '@core/models/profile.model';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  constructor(private httpClient: HttpClient) {}

  getCurrentProfile(): Promise<Profile> {
    return firstValueFrom(this.httpClient.get<Profile>(`${environment.apiUrl}/api/profile`));
  }

  createCurrentProfile(request: CreateProfileRequest): Promise<Profile> {
    return firstValueFrom(
      this.httpClient.post<Profile>(`${environment.apiUrl}/api/profile`, request),
    );
  }

  updateCurrentProfile(request: UpdateProfileRequest): Promise<Profile> {
    return firstValueFrom(
      this.httpClient.put<Profile>(`${environment.apiUrl}/api/profile`, request),
    );
  }
}
