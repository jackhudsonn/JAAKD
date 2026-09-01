import { Component, ElementRef, HostListener, Input, Output, EventEmitter, signal } from '@angular/core';
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
  @Input() profileName: string | null = null;
  @Output() logoutClicked = new EventEmitter<void>();

  menuOpen = signal(false);
  avatarOpen = signal(false);
  mobileMenuOpen = signal(false);

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get displayName() {
    const metadataFirstName = this.user?.user_metadata?.['first_name'];
    const metadataLastName = this.user?.user_metadata?.['last_name'];
    const metadataName = [metadataFirstName, metadataLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return this.profileName?.trim() || metadataName || 'User';
  }

  get displayInitial() {
    return this.displayName?.charAt(0).toUpperCase() || 'U';
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

  toggleMobileMenu() {
    this.avatarOpen.set(false);
    this.menuOpen.set(false);
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  closeMenus() {
  this.closeMenu();
  this.closeAvatarMenu();
  this.closeMobileMenu();
}

@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  const target = event.target as Node;

  const menuWrapper =
    this.elementRef.nativeElement.querySelector('.menu-wrapper');

  const avatarWrapper =
    this.elementRef.nativeElement.querySelector('.avatar-menu-wrapper');

  const profileEnd =
    this.elementRef.nativeElement.querySelector('.profile-end');

  if (
    this.menuOpen() &&
    menuWrapper &&
    !menuWrapper.contains(target)
  ) {
    this.closeMenu();
  }

  if (
    this.avatarOpen() &&
    avatarWrapper &&
    !avatarWrapper.contains(target)
  ) {
    this.closeAvatarMenu();
  }

  if (
    this.mobileMenuOpen() &&
    profileEnd &&
    !profileEnd.contains(target) &&
    !this.elementRef.nativeElement.querySelector('.mobile-nav-dropdown')?.contains(target)
  ) {
    this.closeMobileMenu();
  }
}
@HostListener('document:keydown.escape')
onEscape() {
  this.closeMenus();
}
}
