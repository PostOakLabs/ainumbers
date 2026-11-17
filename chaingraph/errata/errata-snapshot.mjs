// GENERATED FILE - written by scripts/gen-errata-snapshot.mjs. DO NOT hand-edit.
// Inputs: registry/errata/checkpoint (verbatim checkpoint lines), the recorded module
// errata under chaingraph/errata/sources/ and their predicates. Entries are
// append-only (K5): a correction is a new entry, never an edit of this output.
// Imported as a same-origin page-load resource by chaingraph/verify.html; vendored
// into chaingraph/receipt-bundle-verify.html by this writer (that page imports
// nothing: CONTRACT 1.1). KERNEL-ERRATA-READER-1.

export const ERRATA_SNAPSHOT = {
  checkpoint: {
    origin: "ainumbers.co/registry/errata",
    tree_size: 0,
    expires_at: null,
    staleness_sentence: "staleness: Past expires_at, treat it as unknown-refresh-needed — not as continuing to hold, and not as false either.",
    source: "registry/errata/checkpoint"
  },
  entries: [
    {
      id: "KE-2026-0001",
      node_id: "art-807",
      tool_id: "art-807-erc3643-transfer-decision",
      class: "fail-open-missing-input",
      summary: "Returned ALLOWED when required_claim_topics, trusted_issuers or compliance_modules was absent or null.",
      published_at: "2026-11-14",
      kernel_digest_affected: ["sha256:a13bb6fb2360995f8dd6eb7293320ae993dba46132cca39716e58ea13c783ed1"],
      kernel_digest_fixed: "sha256:8414998d60f89bb7841e516b0d9fedf7aa8038973a47ecf91876fc8105c6f899",
      affected_predicate_sha256: "f6fd04f18fd29af490e1cf4b109c0d51c368af7e3c671d2bd7f449e32307032c",
      // Predicate embedded verbatim (export keyword stripped; import-free, K3-pure).
      affected: (function () {
        // KE-2026-0001: proposed by gen-kernel-erratum.mjs (class fail-open-missing-input).
        // True when any listed input is absent or null: the fixed kernel refuses such a receipt.
        const FIELDS = ["compliance_modules","required_claim_topics","trusted_issuers"];
        
        function affected(policy_parameters) {
          const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
          return FIELDS.some((k) => !Object.hasOwn(pp, k) || pp[k] === null || pp[k] === undefined);
        }
        
        return affected;
      })()
    },
    {
      id: "KE-2026-0002",
      node_id: "art-593",
      tool_id: "art-593-webbotauth-nonce-replay-check",
      class: "fail-open-missing-input",
      summary: "Accepted a signed request when expires was absent, null or not a number, because the expiry spread was never evaluated.",
      published_at: "2026-11-14",
      kernel_digest_affected: ["sha256:4d4491d75002a02d8a1448ca25e0aa851ccd4ea646dccde0afdd5d745f48967b"],
      kernel_digest_fixed: "sha256:138c2f487a173ef2bd8b97435481bbacafd2c216a9a9a9663f7526c835d8f57c",
      affected_predicate_sha256: "863ea00f26b2135ae10144f615218a552775d80708e3c05aeda8967f4c03b660",
      // Predicate embedded verbatim (export keyword stripped; import-free, K3-pure).
      affected: (function () {
        // KE-2026-0002: hand-written predicate (class fail-open-missing-input).
        // The old kernel treated the expiry spread as satisfied when `expires` was absent, null or
        // not a number while `created` and `now_unix` were numbers; the fixed kernel refuses.
        // True exactly for that input region. It may be true where both versions agree because the
        // receipt fails another check in both; it is never false where they differ.
        function affected(policy_parameters) {
          const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
          const num = (k) => Object.hasOwn(pp, k) && typeof pp[k] === 'number';
          return num('created') && num('now_unix') && !num('expires');
        }
        
        return affected;
      })()
    },
    {
      id: "KE-2026-0003",
      node_id: "art-776",
      tool_id: "art-776-paypal-dispute-deadline-evidence",
      class: "missed-clause-branch",
      summary: "Ignored the psp input: returned the PayPal dispute timeline for Stripe, Adyen and Square disputes and did not refuse an unknown psp.",
      published_at: "2026-11-14",
      kernel_digest_affected: ["sha256:eccdef3d5f7ca5483630fafd6531b68216f4f0bbab99b37885cc0f2c1a29b6f7"],
      kernel_digest_fixed: "sha256:b516d992d795da30c7dbe1222219c526bbf07fdaf8658f4efcd8ba7847a41a5a",
      affected_predicate_sha256: "43d8643041c562f7d40c1cd23794a048e8d998bde5a973bc24a1599abffb9a13",
      // Predicate embedded verbatim (export keyword stripped; import-free, K3-pure).
      affected: (function () {
        // KE-2026-0003: hand-written predicate (class missed-clause-branch).
        // The old kernel had no `psp` input: it ignored the field and always returned the PayPal
        // dispute timeline. The fixed kernel selects the Stripe, Adyen or Square table and refuses a
        // psp it does not know. A receipt is affected when `psp` is present, is not null, and is not
        // the string "paypal" (trimmed, case-insensitive). Absent psp and "paypal" are unaffected.
        function affected(policy_parameters) {
          const pp = policy_parameters !== null && typeof policy_parameters === 'object' ? policy_parameters : {};
          if (!Object.hasOwn(pp, 'psp') || pp.psp === null || pp.psp === undefined) return false;
          return !(typeof pp.psp === 'string' && pp.psp.trim().toLowerCase() === 'paypal');
        }
        
        return affected;
      })()
    }
  ]
};
