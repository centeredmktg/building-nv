// Mocks MUST come before the import that triggers module loading
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'c1', firstName: 'John', lastName: null,
        email: null, phone: null, type: 'customer',
        primaryCompanyId: null, createdAt: new Date(),
      }),
    },
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET, POST } from '@/app/api/contacts/route';
import { NextRequest } from 'next/server';

it('GET returns empty array for no match', async () => {
  const req = new NextRequest('http://localhost/api/contacts?q=zzznomatch');
  const res = await GET(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});

it('POST returns 400 when firstName missing', async () => {
  const req = new NextRequest('http://localhost/api/contacts', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
