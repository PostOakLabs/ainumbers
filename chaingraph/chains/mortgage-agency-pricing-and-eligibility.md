# Mortgage Agency Pricing and Eligibility

Gated three-step chain: conforming loan limit check feeds agency eligibility matrix (gate: INELIGIBLE routes to non-conforming referral terminal step; ELIGIBLE continues to LLPA pricing stack). Determines agency deliverability and computes the LLPA cost grid for eligible loans. FHFA CLL 2026 + Fannie/Freddie DU/LPA eligibility + LLPA FNM-2025-11-01.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.md

## Workflow chain: Mortgage Agency Pricing and Eligibility

Gated three-step chain: conforming loan limit check feeds agency eligibility matrix (gate: INELIGIBLE routes to non-conforming referral terminal step; ELIGIBLE continues to LLPA pricing stack). Determines agency deliverability and computes the LLPA cost grid for eligible loans. FHFA CLL 2026 + Fannie/Freddie DU/LPA eligibility + LLPA FNM-2025-11-01.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-223-conforming-loan-limit
   Conforming/super-conforming/jumbo classification feeds Step 2 agency eligibility check
2. art-222-agency-eligibility-matrix
   Agency eligibility verdict - gate routes INELIGIBLE to non-conforming referral, ELIGIBLE to LLPA pricing
3. art-221-llpa-stack
   LLPA pricing stack with table_version binding completes the agency pricing and eligibility report - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The borrower sits just inside our FICO and LTV limits. Where does agency eligibility actually decline this file?
Run the AINumbers MCP tool `run_chain` with {"chain":"mortgage-agency-pricing-and-eligibility"} and read `art-222-agency-eligibility-matrix.eligible_flag`.
Re-run with `inputs` for `art-222-agency-eligibility-matrix`, reusing the values that result echoed, with `fico_score` changed so the FICO score is 580. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.html
