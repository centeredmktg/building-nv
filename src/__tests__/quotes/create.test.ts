// Mocks MUST come before the import that triggers module loading
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: { findUnique: jest.fn().mockResolvedValue(null) },
    quote: { create: jest.fn() },
    lineItemSection: { create: jest.fn() },
    lineItem: { create: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST } from '@/app/api/quotes/route';
import { NextRequest } from 'next/server';

it('returns 400 when address is missing', async () => {
  const req = new NextRequest('http://localhost/api/quotes', {
    method: 'POST',
    body: JSON.stringify({ projectType: 'Office Buildout' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
