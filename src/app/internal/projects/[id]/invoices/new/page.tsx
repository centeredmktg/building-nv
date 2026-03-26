import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CreateInvoiceForm from './CreateInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      contracts: {
        where: { status: 'executed' },
        include: {
          changeOrders: { where: { status: 'executed' }, orderBy: { number: 'asc' } },
          quote: {
            include: {
              quoteContacts: { include: { contact: true } },
              quoteCompanies: { include: { company: true } },
            },
          },
        },
      },
      milestones: {
        orderBy: { position: 'asc' },
        include: { invoiceMilestones: true },
      },
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
    },
  });

  if (!project) notFound();

  const contract = project.contracts[0];
  if (!contract) {
    return (
      <div className="max-w-3xl">
        <Link
          href={`/internal/projects/${id}/invoices`}
          className="text-text-muted text-sm hover:text-text-primary mb-4 inline-block"
        >
          ← Invoices
        </Link>
        <div className="border border-border rounded-sm p-8 text-center">
          <p className="text-text-muted">No executed contract found. A contract must be signed before creating invoices.</p>
        </div>
      </div>
    );
  }

  const unbilledMilestones = project.milestones
    .filter((m) => m.invoiceMilestones.length === 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      billingAmount: m.billingAmount,
      position: m.position,
      plannedDate: m.plannedDate?.toISOString() ?? null,
    }));

  const billingQc = contract.quote.quoteContacts.find((qc) => qc.role === 'billing_contact')
    ?? contract.quote.quoteContacts.find((qc) => qc.role === 'decision_maker')
    ?? contract.quote.quoteContacts[0];

  const defaultBillingContactId = billingQc?.contact.id ?? project.projectContacts[0]?.contact.id ?? null;

  const billingCompanyQc = contract.quote.quoteCompanies[0];
  const defaultBillingCompanyId = billingCompanyQc?.company.id ?? project.projectCompanies[0]?.company.id ?? null;

  const contactOptions = [
    ...contract.quote.quoteContacts.map((qc) => ({
      id: qc.contact.id,
      name: [qc.contact.firstName, qc.contact.lastName].filter(Boolean).join(' '),
      role: qc.role,
    })),
    ...project.projectContacts
      .filter((pc) => !contract.quote.quoteContacts.some((qc) => qc.contact.id === pc.contact.id))
      .map((pc) => ({
        id: pc.contact.id,
        name: [pc.contact.firstName, pc.contact.lastName].filter(Boolean).join(' '),
        role: pc.role,
      })),
  ];

  const companyOptions = [
    ...contract.quote.quoteCompanies.map((qc) => ({
      id: qc.company.id,
      name: qc.company.name,
    })),
    ...project.projectCompanies
      .filter((pc) => !contract.quote.quoteCompanies.some((qc) => qc.company.id === pc.company.id))
      .map((pc) => ({
        id: pc.company.id,
        name: pc.company.name,
      })),
  ];

  return (
    <div className="max-w-3xl">
      <Link
        href={`/internal/projects/${id}/invoices`}
        className="text-text-muted text-sm hover:text-text-primary mb-4 inline-block"
      >
        ← Invoices
      </Link>
      <h1 className="text-2xl font-bold text-text-primary mb-6">New Invoice</h1>
      <CreateInvoiceForm
        projectId={id}
        contractId={contract.id}
        unbilledMilestones={unbilledMilestones}
        contactOptions={contactOptions}
        companyOptions={companyOptions}
        defaultBillingContactId={defaultBillingContactId}
        defaultBillingCompanyId={defaultBillingCompanyId}
        changeOrders={contract.changeOrders.map((co) => ({
          id: co.id,
          number: co.number,
          title: co.title,
          priceDelta: co.priceDelta,
        }))}
      />
    </div>
  );
}
