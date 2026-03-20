import { generateSignedPDF } from '@/lib/docs/pdf';
import { existsSync, unlinkSync, statSync } from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'docs-storage', 'test-signed.pdf');

afterAll(() => { if (existsSync(OUT)) unlinkSync(OUT); });

it('generates a PDF file from HTML + signature', async () => {
  const html = '<html><body><h1>Test Document</h1></body></html>';
  const fakeSig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await generateSignedPDF(html, OUT, fakeSig);
  expect(existsSync(OUT)).toBe(true);
  expect(statSync(OUT).size).toBeGreaterThan(1000);
}, 30000); // Puppeteer can be slow
