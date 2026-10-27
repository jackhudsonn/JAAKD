import { toDisplaySymbol } from './display-symbol';

describe('toDisplaySymbol', () => {
  it('removes the provider prefix and quote currency from crypto symbols', () => {
    expect(toDisplaySymbol('X:ETH-USD')).toBe('ETH');
  });

  it('removes the NSE suffix from display symbols', () => {
    expect(toDisplaySymbol('RELIANCE.NS')).toBe('RELIANCE');
  });

  it('leaves non-crypto symbols unchanged', () => {
    expect(toDisplaySymbol('AAPL')).toBe('AAPL');
    expect(toDisplaySymbol('FX:EURUSD')).toBe('FX:EURUSD');
  });
});
