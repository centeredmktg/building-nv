import { buildSigningLinkEmail, buildSignedPDFEmail } from '@/lib/docs/email';

it('buildSigningLinkEmail returns html with signing url', () => {
  const html = buildSigningLinkEmail({
    recipientFirstName: 'John',
    projectTitle: 'Office TI — 500 Liberty St',
    signingUrl: 'https://buildingnv.com/proposals/abc123',
    senderName: 'Cody McDannald',
  });
  expect(html).toContain('https://buildingnv.com/proposals/abc123');
  expect(html).toContain('John');
  expect(html).toContain('Office TI — 500 Liberty St');
});

it('buildSignedPDFEmail returns html with project title', () => {
  const html = buildSignedPDFEmail({
    projectTitle: 'Office TI — 500 Liberty St',
    senderName: 'Cody McDannald',
  });
  expect(html).toContain('Office TI — 500 Liberty St');
});
