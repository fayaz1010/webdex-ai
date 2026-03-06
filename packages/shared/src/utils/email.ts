const COMMON_PATTERNS = [
  '{first}.{last}@{domain}',
  '{first}{last}@{domain}',
  '{f}{last}@{domain}',
  '{first}_{last}@{domain}',
  '{first}@{domain}',
];

export function detectEmailPattern(knownEmails: string[], domain: string): string | null {
  if (knownEmails.length === 0) return null;

  for (const email of knownEmails) {
    const [local] = email.split('@');
    if (local.includes('.')) return '{first}.{last}@{domain}';
    if (local.includes('_')) return '{first}_{last}@{domain}';
    if (local.length <= 3) return '{f}{last}@{domain}';
  }
  return '{first}.{last}@{domain}';
}

export function inferEmail(firstName: string, lastName: string, pattern: string, domain: string): string {
  return pattern
    .replace('{first}', firstName.toLowerCase())
    .replace('{last}', lastName.toLowerCase())
    .replace('{f}', firstName[0]?.toLowerCase() || '')
    .replace('{domain}', domain);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return [...new Set(matches || [])];
}
