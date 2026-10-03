# KYB Beneficial Ownership Attribution

Gated two-step bank KYB chain under FinCEN CDD Rule 31 CFR 1010.230. Step 1 computes indirect natural-person beneficial ownership via recursive ownership-tier multiplication (25% threshold). Gate on /is_beneficial_owner: false exits early (no beneficial owner at or above 25%). Default (true, beneficial owner identified) proceeds to Step 2: W-8 series structural validation for withholding compliance. NOT the CTA/BOI domestic reporting rule. Synthetic entity IDs only. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/chains/kyb-beneficial-ownership-attribution.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/kyb-beneficial-ownership-attribution.md

## Workflow chain: KYB Beneficial Ownership Attribution

Gated two-step bank KYB chain under FinCEN CDD Rule 31 CFR 1010.230. Step 1 computes indirect natural-person beneficial ownership via recursive ownership-tier multiplication (25% threshold). Gate on /is_beneficial_owner: false exits early (no beneficial owner at or above 25%). Default (true, beneficial owner identified) proceeds to Step 2: W-8 series structural validation for withholding compliance. NOT the CTA/BOI domestic reporting rule. Synthetic entity IDs only. Zero PII by construction.

Domain: SME & Commercial Finance

### Steps

1. art-268-compute-cdd-ownership-25pct
   Recursive ownership: is_beneficial_owner (bool), total_indirect_pct, natural_person_breakdown. GATE: is_beneficial_owner=false -> END (no BO at 25%). Default (true) -> Step 2.
2. art-269-validate-w8-series-structural
   W-8 structural checks: is_structurally_valid (bool), violations[], validity_expiry_date, days_until_expiry. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The ownership ledger is in. Which natural persons clear the 25 percent CDD threshold for this entity?
Run the AINumbers MCP tool `run_chain` with {"chain":"kyb-beneficial-ownership-attribution"} and read `art-268-compute-cdd-ownership-25pct.below_threshold_count`.
Re-run with `inputs` for `art-268-compute-cdd-ownership-25pct`, reusing the values that result echoed, with `ownership_tiers` changed so NP_BETA holds 10 percent in ownership_tiers. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/kyb-beneficial-ownership-attribution.html
