import { renderMsaHtml } from '@/lib/docs/msa-template';

const opts = {
  clientName: 'Acme Corp',
  projectTitle: 'Office TI — 123 Main St',
  projectAddress: '123 Main St, Reno NV 89501',
  contractorLicense: 'NV B2 #[LICENSE]',
  effectiveDate: 'March 19, 2026',
  exhibitATitle: 'Signed Proposal — Office TI',
};

it('includes client name', () => {
  expect(renderMsaHtml(opts)).toContain('Acme Corp');
});

it('includes project address', () => {
  expect(renderMsaHtml(opts)).toContain('123 Main St, Reno NV 89501');
});

it('references Exhibit A', () => {
  expect(renderMsaHtml(opts)).toContain('Exhibit A');
});

it('is self-contained HTML', () => {
  const html = renderMsaHtml(opts);
  expect(html).toContain('<html');
  expect(html).toContain('</body>');
});
