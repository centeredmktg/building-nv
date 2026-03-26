import { randomInt } from 'crypto';

export function buildInvoiceNumber(
  shortCode: string | null | undefined,
  issueDate: Date,
  sequenceNumber: number,
  projectId?: string,
): string {
  const code = shortCode ?? (projectId ? projectId.slice(0, 5).toUpperCase() : 'XXXXX');
  const dateStr = issueDate.toISOString().split('T')[0];
  return `${code}-${dateStr}-INV-${sequenceNumber}`;
}

export function generatePasscode(): string {
  return randomInt(100000, 999999).toString();
}
