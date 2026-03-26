import { buildInvoiceNumber, generatePasscode } from '@/lib/invoice-numbering';

describe('buildInvoiceNumber', () => {
  it('formats with shortCode, date, and sequence', () => {
    expect(buildInvoiceNumber('680G4', new Date('2026-03-24'), 1))
      .toBe('680G4-2026-03-24-INV-1');
  });

  it('formats without shortCode using project id prefix', () => {
    expect(buildInvoiceNumber(null, new Date('2026-03-24'), 3, 'clx1234abcdef'))
      .toBe('CLX12-2026-03-24-INV-3');
  });

  it('increments sequence number', () => {
    expect(buildInvoiceNumber('680G4', new Date('2026-04-15'), 5))
      .toBe('680G4-2026-04-15-INV-5');
  });
});

describe('generatePasscode', () => {
  it('returns a 6-digit string', () => {
    const code = generatePasscode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns different codes on subsequent calls', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generatePasscode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
