// Display symbols are pinned server-side and stored on the invoice.
//
// Deriving them from the viewer's locale would render the same AUD invoice as
// "A$" for one person and "AU$" for another. An invoice is a document; it should
// look the same to everyone, forever.

const SYMBOLS = new Map<string, string>([
  ['AUD', 'AU$'],
  ['CAD', 'CA$'],
  ['EUR', '€'],
  ['GBP', '£'],
  ['IDR', 'Rp'],
  ['INR', '₹'],
  ['JPY', '¥'],
  ['MYR', 'RM'],
  ['NZD', 'NZ$'],
  ['PHP', '₱'],
  ['SGD', 'S$'],
  ['THB', '฿'],
  ['USD', 'US$'],
  ['VND', '₫'],
]);

export const KNOWN_CURRENCIES = [...SYMBOLS.keys()];

/**
 * Falls back to the ISO code itself. "1,250.00 SEK" is perfectly readable, so an
 * unmapped currency is a cosmetic gap, not a reason to reject the invoice.
 */
export function symbolFor(code: string): string {
  const upper = code.trim().toUpperCase();

  return SYMBOLS.get(upper) ?? upper;
}
