import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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
    return this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          dob: profile.dob,
          city: profile.city,
          state: profile.state,
          country: profile.country,
          zip_code: profile.zipCode,
        },
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
      .select('id, full_name, avatar_url')
      .eq('id', userId)
      .single<ProfileRow>();
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}
