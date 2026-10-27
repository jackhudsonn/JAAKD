import { TestBed } from '@angular/core/testing';
import { Order } from '@core/models';
import { OrderLogResponse } from '@core/models/api.models';
import { OrderDetailsPopupComponent } from './order-details-popup.component';

describe('OrderDetailsPopupComponent', () => {
  const order: Order = {
    id: 'order-1',
    symbol: 'AAPL',
    currency: 'USD',
    instrumentType: 'equity',
    type: 'buy',
    quantity: 2,
    status: 'EXECUTED',
    createdAt: '2026-01-01T12:03:00',
  };

  const history: OrderLogResponse[] = [
    {
      logOrderId: 'log-submitted',
      orderId: order.id,
      portfolioId: 'portfolio-1',
      instrumentId: 'instrument-1',
      side: 'BUY',
      quantity: order.quantity,
      timestamp: '2026-01-01T12:00:00',
      metadata: null,
      status: 'SUBMITTED',
      executionPrice: 0,
      quotedPrice: 99,
    },
    {
      logOrderId: 'log-pending',
      orderId: order.id,
      portfolioId: 'portfolio-1',
      instrumentId: 'instrument-1',
      side: 'BUY',
      quantity: order.quantity,
      timestamp: '2026-01-01T12:01:00',
      metadata: null,
      status: 'PENDING',
      executionPrice: 0,
      quotedPrice: 99,
    },
    {
      logOrderId: 'log-executed',
      orderId: order.id,
      portfolioId: 'portfolio-1',
      instrumentId: 'instrument-1',
      side: 'BUY',
      quantity: order.quantity,
      timestamp: '2026-01-01T12:03:00',
      metadata: null,
      status: 'EXECUTED',
      executionPrice: 100,
      quotedPrice: 99,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OrderDetailsPopupComponent] });
  });

  it('starts on the latest status and navigates to prior statuses', () => {
    const fixture = TestBed.createComponent(OrderDetailsPopupComponent);
    fixture.componentRef.setInput('order', order);
    fixture.componentRef.setInput('history', history);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.selectedStatus()).toBe('EXECUTED');
    expect(component.selectedTimestamp()).toBe('2026-01-01T12:03:00');
    expect(component.selectedQuotedPrice()).toBe('$99.00');
    expect(component.selectedExecutionPrice()).toBe('$100.00');
    expect(component.canGoToPreviousStatus()).toBe(true);
    expect(component.canGoToNextStatus()).toBe(false);

    component.showPreviousStatus();
    expect(component.selectedStatus()).toBe('PENDING');
    expect(component.selectedTimestamp()).toBe('2026-01-01T12:01:00');
    expect(component.selectedQuotedPrice()).toBe('$99.00');
    expect(component.selectedExecutionPrice()).toBe('-');

    component.showPreviousStatus();
    expect(component.selectedStatus()).toBe('SUBMITTED');
    expect(component.canGoToPreviousStatus()).toBe(false);
    expect(component.canGoToNextStatus()).toBe(true);
  });

  it('shows the error reason for the selected failed status only', () => {
    const failedHistory: OrderLogResponse[] = [
      history[0],
      {
        ...history[1],
        logOrderId: 'log-failed',
        timestamp: '2026-01-01T12:02:00',
        metadata: 'seed:demo:failed | failureReason=Execution timed out',
        status: 'FAILED',
        quotedPrice: null,
      },
    ];
    const fixture = TestBed.createComponent(OrderDetailsPopupComponent);
    fixture.componentRef.setInput('order', { ...order, status: 'FAILED' });
    fixture.componentRef.setInput('history', failedHistory);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.selectedReason()).toBe('Execution timed out');
    expect(component.selectedQuotedPrice()).toBe('-');
    expect(component.selectedExecutionPrice()).toBe('-');
    const detailLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.detail-label') as NodeListOf<HTMLElement>,
    ).map((label) => label.textContent?.trim());
    expect(detailLabels.indexOf('Date')).toBeLessThan(detailLabels.indexOf('Reason'));

    component.showPreviousStatus();
    expect(component.selectedReason()).toBeNull();
  });
});
