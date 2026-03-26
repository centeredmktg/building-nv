// src/app/invoices/[token]/success/page.tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function PaymentSuccessPage({
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
    include: { project: true },
  });

  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment Received</h1>
          <p className="text-gray-600 text-sm mb-4">
            Thank you for your payment for <strong>{invoice.project.name}</strong>.
          </p>

          <div className="bg-gray-50 rounded p-3 mb-6 text-sm">
            <p className="text-gray-500">Invoice</p>
            <p className="text-gray-900 font-medium">{invoice.invoiceNumber}</p>
            <p className="text-gray-500 mt-2">Amount</p>
            <p className="text-gray-900 font-medium">
              ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <p className="text-gray-500 text-xs mb-6">
            Your payment is being processed. You&apos;ll receive a confirmation once it&apos;s complete.
          </p>

          <Link
            href={`/invoices/${token}`}
            className="text-gray-600 text-sm hover:text-gray-900 underline"
          >
            Back to invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
