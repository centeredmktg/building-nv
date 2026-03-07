const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com",
  "yahoo.com", "yahoo.co.uk",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "protonmail.com", "pm.me",
]);

export function extractBusinessDomain(email: string): string | null {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1];
  return CONSUMER_DOMAINS.has(domain) ? null : domain;
}

export function splitName(fullName: string): { first: string; last: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  const last = parts.pop()!;
  return { first: parts.join(" "), last };
}
