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
