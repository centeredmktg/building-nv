import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync } from 'fs';
import path from 'path';

const DOCS_DIR = process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const contract = await prisma.contract.findUnique({ where: { id }, select: { signedPdfPath: true } });
  if (!contract?.signedPdfPath) return new NextResponse('Not found', { status: 404 });

  const resolvedPath = path.resolve(contract.signedPdfPath);
  if (!resolvedPath.startsWith(path.resolve(DOCS_DIR) + path.sep)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let pdf: Buffer;
  try {
    pdf = readFileSync(resolvedPath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return new NextResponse('Not found', { status: 404 });
    console.error('PDF read error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="signed-contract.pdf"',
    },
  });
}
