import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-trade',
  standalone: true,
  templateUrl: './trade.component.html',
  styleUrls: ['./trade.component.css'],
  imports: [CommonModule],
})
export class TradeComponent {
  status = signal<string | null>(null);

  constructor(
    private http: HttpClient,
    private supabase: SupabaseService,
  ) {}

  async ping(): Promise<void> {
    this.status.set('Pinging...');
    const { data } = await this.supabase.getSession();
    const token = data.session?.access_token;
    if (!token) {
      this.status.set('Not signed in');
      return;
    }
    const url = `${environment.apiUrl.replace(/\/+$/, '')}/api/orders`;
    this.http
      .get(url, { headers: { Authorization: `Bearer ${token}` }, responseType: 'text' })
      .subscribe({
        next: (res) => this.status.set(`Response: ${res || 'pong'}`),
        error: (err) => this.status.set('Error: ' + (err?.status || err?.message)),
      });
  }
}
