import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ContractSignatureBlock from './ContractSignatureBlock';

export default async function ContractSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contract = await prisma.contract.findFirst({
    where: { signingToken: token },
    include: { quote: { include: { client: true } } },
  });

  if (!contract) notFound();

  const isExpired = contract.signingTokenExpiresAt && new Date() > contract.signingTokenExpiresAt;
  const isExecuted = contract.status === 'executed';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Contract — {contract.quote.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {contract.quote.client.name}
            {contract.quote.client.company && ` · ${contract.quote.client.company}`}
          </p>
        </div>

        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">
            This signing link has expired. Please contact Building NV for a new link.
          </div>
        )}

        {isExecuted ? (
          <div className="bg-green-50 border border-green-200 rounded p-6 mb-6">
            <p className="text-green-700 font-semibold">Contract Executed</p>
            <p className="text-gray-600 text-sm mt-1">
              Signed by {contract.signerName} on{' '}
              {contract.signedAt
                ? new Date(contract.signedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        ) : (
          <>
            {/* Contract document in iframe */}
            <div className="bg-white border border-gray-200 rounded mb-6" style={{ height: '70vh' }}>
              <iframe
                src={`/api/contracts/${contract.id}/html?token=${token}`}
                className="w-full h-full rounded"
                title="Contract Document"
              />
            </div>

            {!isExpired && (
              <ContractSignatureBlock token={token} contractId={contract.id} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
