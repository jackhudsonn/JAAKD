import { toCash, toHoldings, toInstrumentType, toOpenOrders } from './dashboard-backend.mappers';

describe('dashboard-backend.mappers', () => {
  it('exports expected helpers', () => {
    expect(typeof toCash).toBe('function');
    expect(typeof toHoldings).toBe('function');
    expect(typeof toInstrumentType).toBe('function');
    expect(typeof toOpenOrders).toBe('function');
  });
});
