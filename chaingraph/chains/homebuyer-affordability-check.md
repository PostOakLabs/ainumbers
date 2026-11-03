# Homebuyer Affordability Check

Check the two ratios lenders check first: debt-to-income (DTI) per Fannie Mae Selling Guide B3-6-02 (ART-335) and loan-to-value (LTV) per Fannie Mae Selling Guide B2-1.1-03 (ART-336), then a session receipt aggregating the run's execution hashes (CRY-05). This shows two underwriting ratios, not a promise of approval or denial. Not financial advice.

- Page: https://ainumbers.co/chaingraph/chains/homebuyer-affordability-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/homebuyer-affordability-check.md

## Workflow chain: Homebuyer Affordability Check

Check the two ratios lenders check first: debt-to-income (DTI) per Fannie Mae Selling Guide B3-6-02 (ART-335) and loan-to-value (LTV) per Fannie Mae Selling Guide B2-1.1-03 (ART-336), then a session receipt aggregating the run's execution hashes (CRY-05). This shows two underwriting ratios, not a promise of approval or denial. Not financial advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-335-compute-dti-ratios
   Produces front_end_dti_pct and back_end_dti_pct from gross monthly income, housing payment (PITIA), and other monthly debts; classifies the back-end ratio into a DTI tier
2. art-336-compute-ltv-ratios
   Produces ltv_pct, cltv_pct, and hcltv_pct from appraised value, sales price, and lien amounts; applies the lesser-of-value-or-price rule
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: I earn $8,000/month, my housing payment would be $2,200/month (PITIA), and I have $600/month in other debts. What are my DTI ratios?
Run the AINumbers MCP tool `run_chain` with {"chain":"homebuyer-affordability-check"} and read `art-335-compute-dti-ratios.back_end_dti_pct`.
Re-run with `inputs` for `art-335-compute-dti-ratios`, reusing the values that result echoed, with `housing_payment_pitia` set to 2800. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/homebuyer-affordability-check.html
