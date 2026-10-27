import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { PortfolioValueWidgetComponent } from './portfolio-value.component';

describe('PortfolioValueWidgetComponent', () => {
  it('shows the total, the cash and holdings line, and both returns', () => {
    TestBed.configureTestingModule({
      imports: [PortfolioValueWidgetComponent],
      providers: [
        {
          provide: DASHBOARD_STATE_PORT,
          useValue: {
            accountCash: signal(500),
            holdings: signal([
              { symbol: 'AAPL', instrumentType: 'equity', quantity: 5, indicativePrice: 110 },
            ]),
            transactions: signal([
              {
                id: 'd1',
                type: 'deposit',
                amount: 1000,
                currency: 'USD',
                method: 'bank_transfer',
                status: 'EXECUTED',
                createdAt: '2026-10-01T00:00:00Z',
              },
            ]),
            liveQuotes: signal(new Map([['AAPL', { price: 110, changePct: 10, currency: 'USD' }]])),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PortfolioValueWidgetComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ');

    expect(text).toContain('$1,050.00');
    expect(text).toContain('Cash $500.00 · Holdings $550.00');
    expect(text).toContain('All-Time Return+$50.00+5.00%');
    expect(text).toContain("Today's Return+$50.00+5.00%");
  });
});
