import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Holding, Transaction } from '@core/models';
import { LiveQuote } from '@features/dashboard/services/dashboard-backend.mappers';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { PortfolioValueWidgetComponent } from './portfolio-value.component';

const deposit = (amount: number): Transaction => ({
  id: `deposit-${amount}`,
  type: 'deposit',
  amount,
  currency: 'USD',
  method: 'bank_transfer',
  status: 'EXECUTED',
  createdAt: '2026-10-01T00:00:00Z',
});

describe('PortfolioValueWidgetComponent returns', () => {
  let fixture: ComponentFixture<PortfolioValueWidgetComponent>;

  function render(options: {
    cash: number;
    holdings: Holding[];
    transactions: Transaction[];
    quotes?: [string, LiveQuote][];
  }): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PortfolioValueWidgetComponent],
      providers: [
        {
          provide: DASHBOARD_STATE_PORT,
          useValue: {
            accountCash: signal(options.cash),
            holdings: signal(options.holdings),
            transactions: signal(options.transactions),
            liveQuotes: signal(new Map(options.quotes ?? [])),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PortfolioValueWidgetComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const columns = (element: HTMLElement) =>
    [...element.querySelectorAll('.returns-row .split-column')].map((column) => ({
      label: column.querySelector('.value-label')?.textContent?.trim(),
      amount: column.querySelector('.returns-amount, .split-value')?.textContent?.trim(),
      pct: column.querySelector('.returns-pill')?.textContent?.trim(),
      colour: column.querySelector('.returns-figures')?.classList,
    }));

  afterEach(() => fixture.destroy());

  it('shows All-Time and Today side by side, with the percent in a pill', () => {
    // Deposited 1000, now 500 cash + 5 x 110 = 1050, so +50 (+5%). Up 10% today: +50 on 500.
    const element = render({
      cash: 500,
      holdings: [{ symbol: 'AAPL', instrumentType: 'equity', quantity: 5, indicativePrice: 110 }],
      transactions: [deposit(1000)],
      quotes: [['AAPL', { price: 110, changePct: 10, currency: 'USD' }]],
    });

    const [allTime, today] = columns(element);
    expect(allTime.label).toBe('All-Time Return');
    expect(allTime.amount).toBe('+$50.00');
    expect(allTime.pct).toBe('+5.00%');
    expect(allTime.colour).toContain('positive');
    expect(today.label).toBe("Today's Return");
    expect(today.amount).toBe('+$50.00');
    expect(today.pct).toBe('+10.00%');
  });

  it('shows a loss in red and a flat day in grey with no sign', () => {
    const element = render({
      cash: 500,
      holdings: [{ symbol: 'AAPL', instrumentType: 'equity', quantity: 5, indicativePrice: 80 }],
      transactions: [deposit(1000)],
    });

    const [allTime, today] = columns(element);
    expect(allTime.amount).toBe('-$100.00');
    expect(allTime.pct).toBe('-10.00%');
    expect(allTime.colour).toContain('negative');
    expect(today.amount).toBe('$0.00');
    expect(today.pct).toBe('0.00%');
    expect(today.colour).not.toContain('positive');
    expect(today.colour).not.toContain('negative');
  });

  it('shows only the amount when there is nothing to measure the percent against', () => {
    // Withdrew more than deposited, so All-Time has no base for a percent.
    const element = render({
      cash: 600,
      holdings: [],
      transactions: [deposit(1000), { ...deposit(1500), id: 'w', type: 'withdrawal' }],
    });

    const [allTime] = columns(element);
    expect(allTime.amount).toBe('+$1,100.00');
    expect(allTime.pct).toBeUndefined();
  });

  it('shows "Not available yet" with no holdings and no transactions', () => {
    const element = render({ cash: 0, holdings: [], transactions: [] });

    const [returns] = columns(element);
    expect(columns(element)).toHaveLength(1);
    expect(returns.amount).toBe('Not available yet');
  });

  const text = (element: HTMLElement, selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('always shows the total with a Cash and Holdings line under it', () => {
    const element = render({
      cash: 500,
      holdings: [{ symbol: 'AAPL', instrumentType: 'equity', quantity: 5, indicativePrice: 110 }],
      transactions: [deposit(1000)],
    });

    expect(text(element, '.value-display .value-label')).toBe('Total Value');
    expect(text(element, '.value-amount')).toBe('$1,050.00');
    expect(text(element, '.value-breakdown')).toBe('Cash $500.00 · Holdings $550.00');
  });

  it('shows the total and Holdings as unavailable when a holding has no price', () => {
    const element = render({
      cash: 500,
      holdings: [{ symbol: 'AAPL', instrumentType: 'equity', quantity: 5, indicativePrice: null }],
      transactions: [],
    });

    expect(text(element, '.value-amount')).toBe('Market prices unavailable');
    expect(text(element, '.value-breakdown')).toBe('Cash $500.00 · Holdings price unavailable');
  });
});
