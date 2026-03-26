import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  viewed: 'bg-amber-500/20 text-amber-400',
  paid: 'bg-green-500/20 text-green-400',
};

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function InvoiceListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      invoices: {
        include: {
          billingContact: true,
          billingCompany: true,
        },
        orderBy: { sequenceNumber: 'desc' },
      },
    },
  });

  if (!project) notFound();

  const totalInvoiced = project.invoices
    .filter((inv) => ['sent', 'viewed', 'paid'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPaid = project.invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href={`/internal/projects/${id}`}
            className="text-text-muted text-sm hover:text-text-primary mb-2 inline-block"
          >
            ← Project
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Invoices</h1>
          <p className="text-text-muted text-sm mt-1">{project.name}</p>
        </div>
        <Link
          href={`/internal/projects/${id}/invoices/new`}
          className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Invoice
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-border rounded-sm p-4">
          <p className="text-text-muted text-xs">Total Invoiced</p>
          <p className="text-text-primary text-lg font-semibold">{fmtCurrency(totalInvoiced)}</p>
        </div>
        <div className="border border-border rounded-sm p-4">
          <p className="text-text-muted text-xs">Total Paid</p>
          <p className="text-text-primary text-lg font-semibold">{fmtCurrency(totalPaid)}</p>
        </div>
        <div className="border border-border rounded-sm p-4">
          <p className="text-text-muted text-xs">Outstanding</p>
          <p className="text-text-primary text-lg font-semibold">
            {fmtCurrency(totalInvoiced - totalPaid)}
          </p>
        </div>
      </div>

      {/* Invoice list */}
      {project.invoices.length === 0 ? (
        <div className="border border-border rounded-sm p-8 text-center">
          <p className="text-text-muted">No invoices yet.</p>
          <Link
            href={`/internal/projects/${id}/invoices/new`}
            className="text-accent text-sm hover:underline mt-2 inline-block"
          >
            Create the first invoice
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {project.invoices.map((inv) => {
            const contactName = [inv.billingContact.firstName, inv.billingContact.lastName]
              .filter(Boolean)
              .join(' ');
            return (
              <Link
                key={inv.id}
                href={`/internal/projects/${id}/invoices/${inv.id}`}
                className="flex items-center justify-between p-4 hover:bg-surface-2 transition-colors"
              >
                <div>
                  <p className="text-text-primary text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {fmtDate(inv.issueDate)} · {contactName}
                    {inv.billingCompany ? ` · ${inv.billingCompany.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-primary text-sm font-medium">
                    {fmtCurrency(inv.amount)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status] ?? ''}`}
                  >
                    {inv.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
