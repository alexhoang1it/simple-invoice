import { KNOWN_CURRENCIES, symbolFor } from './currency';

describe('symbolFor', () => {
  it.each([
    ['AUD', 'AU$'],
    ['USD', 'US$'],
    ['GBP', '£'],
    ['EUR', '€'],
    ['SGD', 'S$'],
    ['VND', '₫'],
  ])('maps %s to %s', (code, symbol) => {
    expect(symbolFor(code)).toBe(symbol);
  });

  it('normalises case and whitespace', () => {
    expect(symbolFor(' aud ')).toBe('AU$');
  });

  it('falls back to the code when there is no symbol for it', () => {
    expect(symbolFor('SEK')).toBe('SEK');
    expect(symbolFor('zar')).toBe('ZAR');
  });

  it('keeps the dollar currencies distinguishable', () => {
    const dollars = ['AUD', 'USD', 'SGD', 'NZD', 'CAD'].map(symbolFor);

    expect(new Set(dollars).size).toBe(dollars.length);
  });

  it('has a symbol for every currency it advertises', () => {
    for (const code of KNOWN_CURRENCIES) {
      expect(symbolFor(code)).toBeTruthy();
    }
  });
});
