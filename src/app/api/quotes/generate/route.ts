import { NextRequest } from 'next/server';
import { generateQuoteStream } from '@/lib/claude';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scopeText } = await req.json();
  if (!scopeText) {
    return NextResponse.json({ error: 'scopeText is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateQuoteStream(scopeText)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        }
      } catch (err) {
        console.error('Stream error:', err);
        const message = err instanceof Error ? err.message : 'Quote generation failed';
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
