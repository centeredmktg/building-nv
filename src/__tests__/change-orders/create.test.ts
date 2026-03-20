import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findUnique: jest.fn().mockResolvedValue(null) },
    changeOrder: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
  },
}));

jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST } from '@/app/api/change-orders/route';

it('returns 401 when not authenticated', async () => {
  const req = new NextRequest('http://localhost/api/change-orders', {
    method: 'POST',
    body: JSON.stringify({ contractId: 'bad', title: 'CO1', scopeDelta: 'Extra', priceDelta: 500 }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(401);
});
