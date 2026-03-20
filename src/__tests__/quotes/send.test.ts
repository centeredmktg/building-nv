import { NextRequest } from 'next/server';

// Mock prisma before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
  },
}));

// Mock next-auth to simulate an authenticated session
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }),
}));

// Mock the email helper — we don't want real sends in tests
jest.mock('@/lib/docs/email', () => ({
  sendSigningLink: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/quotes/[id]/send/route';

it('returns 404 for non-existent quote', async () => {
  const req = new NextRequest('http://localhost/api/quotes/nonexistent/send', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'nonexistent' }) });
  expect(res.status).toBe(404);
});
