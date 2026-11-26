// KE-2026-0002: hand-written predicate (class fail-open-missing-input).
// The old kernel treated the expiry spread as satisfied when `expires` was absent, null or
// not a number while `created` and `now_unix` were numbers; the fixed kernel refuses.
// True exactly for that input region. It may be true where both versions agree because the
// receipt fails another check in both; it is never false where they differ.
export function affected(policy_parameters) {
  const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
  const num = (k) => Object.hasOwn(pp, k) && typeof pp[k] === 'number';
  return num('created') && num('now_unix') && !num('expires');
}
