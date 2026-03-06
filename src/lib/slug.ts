export function generateQuoteSlug(clientName: string, address: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  return `${date}-${toSlug(clientName)}-${toSlug(address)}`;
}
