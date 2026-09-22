/**
 * What makes an address look machine-made rather than a person's, per #93: the
 * e2e suite registered its users against production before it was pointed
 * elsewhere, with addresses like `e2e+1717171717@vehiclevault.dev`.
 *
 * Leans towards flagging too much. Nothing is deleted on these signals alone —
 * a human reviews the shortlist, and deletion takes the ids they approved.
 */
export type TestAccountSignal =
  | 'e2e'
  | 'playwright'
  | 'example-domain'
  | 'disposable-domain'
  | 'plus-tagged';

// Public inboxes: whoever types the name reads the mail, a password reset included.
const DISPOSABLE_DOMAINS = new Set(['mailinator.com']);

export function testAccountSignals(email: string): TestAccountSignal[] {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  const local = at === -1 ? address : address.slice(0, at);
  const domain = at === -1 ? '' : address.slice(at + 1);

  const signals: TestAccountSignal[] = [];
  if (local.includes('e2e')) signals.push('e2e');
  if (address.includes('playwright')) signals.push('playwright');
  // Reserved for documentation (RFC 2606): nobody receives mail there.
  if (/(^|\.)example\.(com|org|net)$/.test(domain)) signals.push('example-domain');
  if (DISPOSABLE_DOMAINS.has(domain)) signals.push('disposable-domain');
  if (local.includes('+')) signals.push('plus-tagged');

  return signals;
}
