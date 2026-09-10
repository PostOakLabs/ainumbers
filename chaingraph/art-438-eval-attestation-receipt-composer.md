# Eval Attestation Receipt Composer

Hashes a third-party eval log (e.g. an Inspect AI transcript) and binds it into a receipt that a compiled Work Mandate (art-274) can reference. VERIFY-ONLY: never executes, re-runs, or re-scores the eval - composes shipped §4 hash, §16 signature, and §20 anchor carriers around a digest the caller already produced. claim_strength is the weakest-link status across the eval log hash and the mandate reference, never inflated by one strong leg covering a missing other.

- Page: https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.md
- MCP tool: compose_eval_attestation_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- eval_log (unknown, required)
- mandate_reference (unknown, required)

## Outputs

- attestation_determination (string, optional)
- claim_strength (string, optional)
- eval_format (string, optional)
- eval_id (string, optional)
- eval_log_hash (string, optional)
- mandate_reference (object, optional)
- not_proven (array, optional)
- verify_instructions (string, optional)

## Sample

```json
{
  "eval_log": {
    "hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "format": "inspect_ai_eval_log",
    "eval_id": "inspect-eval-2026-07-23-001"
  },
  "mandate_reference": {
    "work_mandate_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "policy_id": "governance-policy-eval-gate-v1"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compose_eval_attestation_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
