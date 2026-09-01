import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface ProfileRow {
  userID: string;
  email: string;
  userType: number;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  dob: string | null;
  avatar: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  }
  signUp(
    email: string,
    password: string,
    profile: {
      firstName: string;
      lastName: string;
      dob?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    },
  ) {
    // Build metadata object only with defined fields
    // Supabase auth expects snake_case keys in user_metadata
    const metadata: Record<string, any> = {
      first_name: profile.firstName,
      last_name: profile.lastName,
    };
    if (profile.dob) metadata['dob'] = profile.dob;
    if (profile.city) metadata['city'] = profile.city;
    if (profile.state) metadata['state'] = profile.state;
    if (profile.country) metadata['country'] = profile.country;
    if (profile.zipCode) metadata['zip_code'] = profile.zipCode;

    return this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  }

  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  getSession() {
    return this.supabase.auth.getSession();
  }

  getProfile(userId: string) {
    return this.supabase
      .from('profiles')
      .select('userID, email, userType, firstName, lastName, city, state, country, zipCode, dob, avatar')
      .eq('userID', userId)
      .single<ProfileRow>();
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
  sendPasswordReset(email: string, redirectTo: string) {
    return this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
  }

  updatePassword(password: string) {
    return this.supabase.auth.updateUser({
      password,
    });
  }
}
