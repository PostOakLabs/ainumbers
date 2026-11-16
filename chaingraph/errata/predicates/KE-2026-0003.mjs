// KE-2026-0003: hand-written predicate (class missed-clause-branch).
// The old kernel had no `psp` input: it ignored the field and always returned the PayPal
// dispute timeline. The fixed kernel selects the Stripe, Adyen or Square table and refuses a
// psp it does not know. A receipt is affected when `psp` is present, is not null, and is not
// the string "paypal" (trimmed, case-insensitive). Absent psp and "paypal" are unaffected.
export function affected(policy_parameters) {
  const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
  if (!Object.hasOwn(pp, 'psp') || pp.psp === null || pp.psp === undefined) return false;
  return !(typeof pp.psp === 'string' && pp.psp.trim().toLowerCase() === 'paypal');
}
