// Resolves the primary client info from a quote's quoteContacts/quoteCompanies.

type QuoteContact = {
  role: string;
  contact: { firstName: string; lastName?: string | null; email?: string | null };
};

type QuoteCompany = {
  company: { name: string };
};

type QuoteWithContacts = {
  quoteContacts?: QuoteContact[];
  quoteCompanies?: QuoteCompany[];
};

export type ResolvedClient = {
  name: string;
  email: string | null;
  company: string | null;
};

export function resolveQuoteClient(quote: QuoteWithContacts): ResolvedClient {
  const primary =
    quote.quoteContacts?.find((qc) => qc.role === 'decision_maker') ??
    quote.quoteContacts?.[0];

  const company = quote.quoteCompanies?.[0]?.company.name ?? null;

  if (!primary) {
    return { name: 'Client', email: null, company };
  }

  const c = primary.contact;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return { name, email: c.email ?? null, company };
}
