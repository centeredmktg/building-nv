import { renderChangeOrderHtml } from '@/lib/docs/change-order-template';

const opts = {
  coNumber: 1,
  projectTitle: 'Office TI — 123 Main St',
  clientName: 'Acme Corp',
  contractDate: 'March 19, 2026',
  scopeDelta: 'Add (2) additional electrical outlets in conference room.',
  priceDelta: 850,
  originalContractAmount: 45000,
  effectiveDate: 'March 25, 2026',
};

it('renders CO number and project title', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('Change Order #1');
  expect(html).toContain('Office TI — 123 Main St');
});

it('renders scope delta and price delta', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('additional electrical outlets');
  expect(html).toContain('850');
});

it('calculates revised contract amount', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('45,850');
});

it('renders negative price delta as credit', () => {
  const html = renderChangeOrderHtml({
    ...opts,
    priceDelta: -500,
    originalContractAmount: 45000,
  });
  expect(html).toContain('-$500');
  expect(html).toContain('44,500'); // revised = 45000 - 500
});
