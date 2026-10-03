# International Wires ISO Migration Preflight

Per-template preflight for the Nov 16 2026 ISO 20022 structured-address harmonization deadline: CBPR+ structured-address lint, purpose-code requirement check, LEI payment-binding lint, and MT-MX translation fidelity score. PASS only when all four checks pass; FAIL surfaces the failing check(s). Each receipt records which template/version was checked so re-runs show drift toward compliance across receipts.

- Page: https://ainumbers.co/chaingraph/chains/intl-wire-iso-preflight-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/intl-wire-iso-preflight-composer.md

## Workflow chain: International Wires ISO Migration Preflight

Per-template preflight for the Nov 16 2026 ISO 20022 structured-address harmonization deadline: CBPR+ structured-address lint, purpose-code requirement check, LEI payment-binding lint, and MT-MX translation fidelity score. PASS only when all four checks pass; FAIL surfaces the failing check(s). Each receipt records which template/version was checked so re-runs show drift toward compliance across receipts.

Domain: Cross-Border & Instant Payments

### Steps

1. art-241-cbpr-structured-address-linter
   structured-address lint result feeds Stage 2 purpose-code check
2. art-243-purpose-code-requirement-checker
   purpose-code check result feeds Stage 3 LEI payment-binding lint
3. art-246-lei-payment-binding-linter
   LEI payment-binding lint result feeds Stage 4 translation-fidelity scoring
4. art-245-mt-mx-translation-fidelity-scorer
   translation-fidelity score composes with the prior three checks into the per-template PASS/FAIL ISO-migration preflight receipt. Terminal stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does this payment's address data satisfy the CBPR+ structured addressing rules before the migration cut-off?
Run the AINumbers MCP tool `run_chain` with {"chain":"intl-wire-iso-preflight"} and read `art-241-cbpr-structured-address-linter.compliant`.
Re-run with `inputs` for `art-241-cbpr-structured-address-linter`, reusing the values that result echoed, with `address_lines` changed so the address is free-text lines and the structured fields are gone. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/intl-wire-iso-preflight.html
