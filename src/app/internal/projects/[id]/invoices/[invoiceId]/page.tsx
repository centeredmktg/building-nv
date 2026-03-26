import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InvoiceActions from './InvoiceActions';

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
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id, invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      invoiceMilestones: { include: { milestone: true } },
    },
  });

  if (!invoice || invoice.projectId !== id) notFound();

  const contactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href={`/internal/projects/${id}/invoices`}
            className="text-text-muted text-sm hover:text-text-primary mb-2 inline-block"
          >
            ← Invoices
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">{invoice.invoiceNumber}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[invoice.status] ?? ''}`}>
              {invoice.status}
            </span>
            <span className="text-text-muted text-sm">{fmtCurrency(invoice.amount)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/invoices/${invoiceId}/pdf`}
            target="_blank"
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:text-text-primary transition-colors"
          >
            Download PDF
          </a>
        </div>
      </div>

      {/* Invoice preview */}
      <div className="border border-border rounded-sm mb-6" style={{ height: '60vh' }}>
        <iframe
          src={`/api/invoices/${invoiceId}/html`}
          className="w-full h-full rounded-sm"
          title="Invoice Preview"
        />
      </div>

      {/* Details */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-muted text-xs">Billing Contact</p>
            <p className="text-text-primary">{contactName}</p>
            {invoice.billingContact.email && (
              <p className="text-text-muted text-xs">{invoice.billingContact.email}</p>
            )}
          </div>
          <div>
            <p className="text-text-muted text-xs">Billing Company</p>
            <p className="text-text-primary">{invoice.billingCompany?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Issue Date</p>
            <p className="text-text-primary">{fmtDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Due Date</p>
            <p className="text-text-primary">{fmtDate(invoice.dueDate)}</p>
          </div>
          {invoice.sentAt && (
            <div>
              <p className="text-text-muted text-xs">Sent</p>
              <p className="text-text-primary">{fmtDate(invoice.sentAt)}</p>
            </div>
          )}
          {invoice.viewedAt && (
            <div>
              <p className="text-text-muted text-xs">First Viewed</p>
              <p className="text-text-primary">{fmtDate(invoice.viewedAt)}</p>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <p className="text-text-muted text-xs">Paid</p>
              <p className="text-text-primary">
                {fmtDate(invoice.paidAt)} via {invoice.paidMethod}
              </p>
            </div>
          )}
        </div>
        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-text-muted text-xs">Project Note</p>
            <p className="text-text-primary text-sm">{invoice.notes}</p>
          </div>
        )}
      </section>

      {/* Milestones billed */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Milestones Billed</h2>
        <div className="space-y-2">
          {invoice.invoiceMilestones.map((im) => (
            <div key={im.id} className="flex items-center justify-between text-sm">
              <span className="text-text-primary">{im.milestone.name}</span>
              <span className="text-text-muted">
                {im.milestone.billingAmount != null
                  ? fmtCurrency(im.milestone.billingAmount)
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <InvoiceActions
        invoiceId={invoiceId}
        projectId={id}
        status={invoice.status}
        passcode={invoice.passcode}
      />
    </div>
  );
}
