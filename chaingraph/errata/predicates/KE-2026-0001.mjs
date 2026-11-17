// KE-2026-0001: proposed by gen-kernel-erratum.mjs (class fail-open-missing-input).
// True when any listed input is absent or null: the fixed kernel refuses such a receipt.
const FIELDS = ["compliance_modules","required_claim_topics","trusted_issuers"];

export function affected(policy_parameters) {
  const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
  return FIELDS.some((k) => !Object.hasOwn(pp, k) || pp[k] === null || pp[k] === undefined);
}
