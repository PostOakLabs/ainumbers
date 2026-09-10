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
