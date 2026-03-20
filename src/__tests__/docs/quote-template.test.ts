import { renderQuoteHtml } from '@/lib/docs/quote-template';

const mockQuote = {
  id: 'q1',
  slug: 'test-slug',
  title: 'Office TI',
  address: '123 Main St, Reno NV',
  projectType: 'Tenant Improvement',
  materialMarkupPct: 10,
  overheadPct: 10,
  profitPct: 10,
  paymentTerms: '10% at signing.',
  exclusions: 'Permits.',
  notes: null,
  createdAt: new Date('2026-03-19'),
  client: { name: 'Acme Corp', company: 'Acme Corp', email: 'acme@example.com', phone: null },
  sections: [
    {
      id: 's1',
      title: 'Framing',
      position: 0,
      items: [{ id: 'i1', description: 'Metal stud framing', quantity: 1, unit: 'ls', unitPrice: 5000, isMaterial: false, position: 0 }],
    },
  ],
};

it('renders quote title and client name', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('Office TI');
  expect(html).toContain('Acme Corp');
  expect(html).toContain('123 Main St');
});

it('renders line item description', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('Metal stud framing');
  expect(html).toContain('5,000');
});

it('is self-contained HTML (has html/head/body)', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('<html');
  expect(html).toContain('</body>');
});
