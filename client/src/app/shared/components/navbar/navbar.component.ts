import { Component, ElementRef, HostListener, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  @Input() user: User | null = null;
  @Output() logoutClicked = new EventEmitter<void>();

  menuOpen = signal(false);
  avatarOpen = signal(false);

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get displayName() {
    return this.user?.user_metadata?.['full_name'] || this.user?.email || 'Signed in user';
  }

  get displayInitial() {
    return this.displayName.charAt(0).toUpperCase();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.menuOpen() && !this.avatarOpen()) return;
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
