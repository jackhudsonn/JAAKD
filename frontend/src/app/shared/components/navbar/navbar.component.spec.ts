import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    fixture.componentRef.setInput('isLoggedIn', true);
    fixture.componentRef.setInput('userEmail', 'user@example.com');
  });

  function linkTexts(selector: string): string[] {
    return [...fixture.nativeElement.querySelectorAll(`${selector} a`)].map((link: Element) =>
      link.textContent!.trim(),
    );
  }

  function openMenus() {
    fixture.componentInstance.toggleMobileMenu();
    fixture.detectChanges();
    fixture.componentInstance.toggleAvatarMenu();
    fixture.detectChanges();
  }

  it('shows an analyst only the Analytics link, with no More menu or payment methods', () => {
    fixture.componentRef.setInput('canAccessAnalyst', true);
    fixture.componentRef.setInput('analystOnly', true);
    fixture.detectChanges();

    expect(linkTexts('.app-nav')).toEqual(['Analytics']);
    expect(fixture.nativeElement.querySelector('.nav-more-button')).toBeNull();

    fixture.componentInstance.toggleMobileMenu();
    fixture.detectChanges();
    expect(linkTexts('.mobile-nav-dropdown')).toEqual(['Analytics']);

    fixture.componentInstance.toggleAvatarMenu();
    fixture.detectChanges();
    expect(linkTexts('.avatar-dropdown')).toEqual(['Account']);
  });

  it('shows an admin the full navigation, Analytics included', () => {
    fixture.componentRef.setInput('canAccessAnalyst', true);
    fixture.componentRef.setInput('canAccessAuditor', true);
    fixture.detectChanges();

    expect(linkTexts('.app-nav')).toEqual([
      'Dashboard',
      'Transact',
      'Trade',
      'Dev Testing',
      'Auditor Lab',
      'Analytics',
    ]);
    expect(fixture.nativeElement.querySelector('.nav-more-button')).not.toBeNull();

    fixture.componentInstance.toggleAvatarMenu();
    fixture.detectChanges();
    expect(linkTexts('.avatar-dropdown')).toEqual(['Account', 'Payment Methods']);
  });

  it('hides Analytics from retail users', () => {
    fixture.detectChanges();
    openMenus();

    expect(linkTexts('.app-nav')).not.toContain('Analytics');
    expect(linkTexts('.mobile-nav-dropdown')).not.toContain('Analytics');
  });
});
