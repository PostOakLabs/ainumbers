# 24/7 Tokenized Collateral Mobility

W-D. Tokenized-collateral eligibility (505) -> 24/7 cross-network collateral mobilization (513) -> haircut/valuation (508). Frames the DTCC tokenized-collateral wedge: moving eligible collateral across networks on a 24/7 basis. Educational estimator, not a settlement instruction.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-collateral-mobility.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-collateral-mobility.md

## Workflow chain: 24/7 Tokenized Collateral Mobility

W-D. Tokenized-collateral eligibility (505) -> 24/7 cross-network collateral mobilization (513) -> haircut/valuation (508). Frames the DTCC tokenized-collateral wedge: moving eligible collateral across networks on a 24/7 basis. Educational estimator, not a settlement instruction.

Domain: Wholesale Settlement

### Steps

1. 505-tokenized-collateral-eligibility-checker
   eligibility verdict (H1) feeds the mobilizer
2. 513-margin-call-collateral-mobilizer
   mobilization plan (H2) feeds the haircut calculator
3. 508-repo-haircut-collateral-calculator
   Exports composite collateral-mobility artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A sharp mark-to-market move hits the book and the margin call balloons. Can the collateral we already hold still cover it?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-collateral-mobility"} and read `513-margin-call-collateral-mobilizer.shortfall`.
Re-run with `inputs` for `513-margin-call-collateral-mobilizer`, reusing the values that result echoed, with `portfolio_mtm` set to -5000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-collateral-mobility.html
