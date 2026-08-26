import { Component } from '@angular/core';
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
  message: string = '';

  constructor(private supabaseService: SupabaseService) {}

  async login() {
    const { error } = await this.supabaseService.signIn(this.email, this.password);
    if (error) {
      this.message = error.message;
      return;
    }
    this.message = 'Logged in successfully!';
  }
}