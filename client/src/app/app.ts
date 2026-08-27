import { Component, ElementRef, HostListener, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  email = '';
  password = '';

  message = signal('');
  user = signal<User | null>(null);
  menuOpen = signal(false);
  avatarOpen = signal(false);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  async ngOnInit() {
    const { data } =
      await this.supabaseService.getSession();

    this.user.set(
      data.session?.user ?? null
    );

    this.supabaseService.onAuthStateChange(
      (_event: string, session: any) => {
        this.user.set(
          session?.user ?? null
        );
      }
    );
  }

  async login() {
    const { error } =
      await this.supabaseService.signIn(
        this.email,
        this.password
      );

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.message.set('');
    await this.router.navigate(['/dashboard']);
  }

  async signUp() {
    const { data, error } =
      await this.supabaseService.signUp(
        this.email,
        this.password
      );

    if (error) {
      this.message.set(error.message);
      return;
    }

    if (data.session) {
      this.message.set('');
      await this.router.navigate(['/dashboard']);
    } else {
      this.message.set(
        'Account created. Check your email to confirm your account.'
      );
    }
  }

  async logout() {
    const { error } =
      await this.supabaseService.signOut();

    if (error) {
      this.message.set(error.message);
      return;
    }

    this.email = '';
    this.password = '';
    this.message.set('');

    await this.router.navigate(['/']);
  }

  toggleMenu() {
    this.avatarOpen.set(false);
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  toggleAvatarMenu() {
    this.menuOpen.set(false);
    this.avatarOpen.update((open) => !open);
  }

  closeAvatarMenu() {
    this.avatarOpen.set(false);
  }

  get displayName() {
    return this.user()?.user_metadata?.['full_name'] || this.user()?.email || 'Signed in user';
  }

  get displayInitial() {
    return this.displayName.charAt(0).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.menuOpen() && !this.avatarOpen()) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeAvatarMenu();
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeAvatarMenu();
    this.closeMenu();
  }
}
