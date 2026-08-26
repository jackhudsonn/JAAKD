import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from './services/supabase.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  email: string = '';
  password: string = '';
  fullName: string = '';
  message = signal('');

  constructor(private supabaseService: SupabaseService) {}

  async login() {
    const { error } = await this.supabaseService.signIn(this.email, this.password);
    if (error) {
      this.message.set(error.message);
      return;
    }
    this.message.set('Logged in successfully!');
  }
  async signUp() {
    const { error } = await this.supabaseService.signUp(this.email, this.password, this.fullName);
    if (error) {
      this.message.set(error.message);
      return;
    }
    this.message.set('Account created. Signed up successfully!');
  }
  async logout() {
    const { error } = await this.supabaseService.signOut();
    if (error) {
      this.message.set(error.message);
      return;
    }
    this.message.set('Signed out successfully!');
  }
}