import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST } from '@/app/api/contracts/[id]/send/route';

it('returns 401 when not authenticated', async () => {
  const req = new NextRequest('http://localhost/api/contracts/bad-id/send', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
  expect(res.status).toBe(401);
});
