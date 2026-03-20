import { POST } from '@/app/api/quotes/[id]/convert-to-contract/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    contract: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { email: 'test@test.com' } }),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

it('returns 404 for non-existent quote', async () => {
  const req = new NextRequest('http://localhost', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
  expect(res.status).toBe(404);
});
