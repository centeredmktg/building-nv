import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ChangeOrderSigningBlock from './ChangeOrderSigningBlock';

export default async function ChangeOrderSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const changeOrder = await prisma.changeOrder.findFirst({
    where: { signingToken: token },
    include: { contract: { include: { quote: true } } },
  });

  if (!changeOrder) notFound();

  const isExpired = changeOrder.signingTokenExpiresAt && new Date() > changeOrder.signingTokenExpiresAt;
  const isExecuted = changeOrder.status === 'executed';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Change Order #{changeOrder.number} — {changeOrder.title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{changeOrder.contract.quote.title}</p>
        </div>

        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">
            This signing link has expired. Please contact Building NV for a new link.
          </div>
        )}

        {isExecuted ? (
          <div className="bg-green-50 border border-green-200 rounded p-6 mb-6">
            <p className="text-green-700 font-semibold">Change Order Executed</p>
            <p className="text-gray-600 text-sm mt-1">
              Signed by {changeOrder.signerName} on{' '}
              {changeOrder.signedAt
                ? new Date(changeOrder.signedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        ) : (
          <>
            {/* Change order document in iframe */}
            <div className="bg-white border border-gray-200 rounded mb-6" style={{ height: '70vh' }}>
              <iframe
                src={`/api/change-orders/${changeOrder.id}/html?token=${token}`}
                className="w-full h-full rounded"
                title="Change Order Document"
              />
            </div>

            {!isExpired && (
              <ChangeOrderSigningBlock token={token} executed={false} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
