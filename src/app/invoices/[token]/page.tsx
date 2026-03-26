import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PasscodeGate from './PasscodeGate';

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  const invoice = await prisma.invoice.findFirst({
    where: { viewToken: token },
    include: { project: true, billingContact: true },
  });

  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Invoice {invoice.invoiceNumber}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{invoice.project.name}</p>
        </div>

        <PasscodeGate
          invoiceId={invoice.id}
          token={token}
          alreadyViewed={!!invoice.viewedAt}
          invoiceStatus={invoice.status}
        />
      </div>
    </div>
  );
}
