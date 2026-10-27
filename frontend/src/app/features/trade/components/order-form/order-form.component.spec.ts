import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderFormComponent, OrderFormSubmit } from './order-form.component';

describe('OrderFormComponent', () => {
  let fixture: ComponentFixture<OrderFormComponent>;
  let component: OrderFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('currentPrice', 10);
    fixture.componentRef.setInput('accountCash', 100);
    fixture.detectChanges();
  });

  it('starts with a quantity of 1', () => {
    expect(component.quantity()).toBe(1);
    expect(component.error()).toBe('');
  });

  it('accepts a fractional buy within available cash', () => {
    component.quantity.set(0.5);

    expect(component.error()).toBe('');
  });

  it('rejects more than 6 decimals', () => {
    component.quantity.set(0.1234567);

    expect(component.error()).toBe('Enter a quantity greater than zero (up to 6 decimals).');
  });

  it('caps max affordable at 6 decimals rounded down', () => {
    fixture.componentRef.setInput('currentPrice', 3);

    expect(component.maxBuyQuantity()).toBe(33.333333);
  });

  it('resets the quantity to 1 after a successful submit', () => {
    const placed: OrderFormSubmit[] = [];
    component.placed.subscribe((order) => placed.push(order));
    component.quantity.set(2.5);

    component.submit();

    expect(placed).toEqual([{ type: 'buy', quantity: 2.5 }]);
    expect(component.quantity()).toBe(1);
  });

  it('shows "-" in the preview rows when the quantity is empty', () => {
    component.quantity.set(null);
    fixture.detectChanges();

    const values = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.order-preview-value'),
    ].map((value) => value.textContent?.trim());

    expect(values).toEqual(['-', '-', '10 share(s)']);
  });

  it('formats the estimate in instrument currency and hides USD-only cash estimates for foreign currency', () => {
    fixture.componentRef.setInput('currency', 'INR');
    component.quantity.set(2);
    fixture.detectChanges();

    const values = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.order-preview-value'),
    ].map((value) => value.textContent?.trim());

    expect(values).toEqual(['₹20.00', 'Unavailable', 'Unavailable']);
  });
});
