import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  }

  signUp(email: string, password: string, fullName: string) {
    return this.supabase.auth.signUp({ email, password,
        options: {
            data: {
                full_name: fullName
            }
        }
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
  onAuthStateChange(callback: any) {
  return this.supabase.auth.onAuthStateChange(callback);
}
}
