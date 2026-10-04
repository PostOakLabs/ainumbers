# Solvency II Reconciliation and Capital

Calculate SCR and MCR coverage ratios and check Tier-1/Tier-3 tiering limits under Solvency II Delegated Regulation 2015/35 (art-180) -> bridge SII technical provisions to IFRS 17 insurance contract liabilities and flag gaps outside 10% tolerance using EIOPA benchmarks (art-181) -> A-F insurance reporting readiness diagnostic across IFRS 17, SII Pillar-3 QRT, reconciliation, and ICS dimensions (art-182). Full Solvency II capital and reconciliation pipeline. Solvency II Dir. 2009/138/EC + IFRS 17.

- Page: https://ainumbers.co/chaingraph/chains/solvency-ii-reconciliation-and-capital.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/solvency-ii-reconciliation-and-capital.md

## Workflow chain: Solvency II Reconciliation and Capital

Calculate SCR and MCR coverage ratios and check Tier-1/Tier-3 tiering limits under Solvency II Delegated Regulation 2015/35 (art-180) -> bridge SII technical provisions to IFRS 17 insurance contract liabilities and flag gaps outside 10% tolerance using EIOPA benchmarks (art-181) -> A-F insurance reporting readiness diagnostic across IFRS 17, SII Pillar-3 QRT, reconciliation, and ICS dimensions (art-182). Full Solvency II capital and reconciliation pipeline. Solvency II Dir. 2009/138/EC + IFRS 17.

Domain: Insurance & Reinsurance

### Steps

1. art-180-solvency2-scr-ratio-calculator
   SCR/MCR coverage ratios and tiering verdict feed reconciliation bridger
2. art-181-sii-ifrs17-reconciliation-bridger
   SII-IFRS 17 bridge delta and RA benchmark feed readiness diagnostic
3. art-182-insurance-reporting-readiness-diagnostic
   Exports A-F insurance reporting readiness grade with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Quarter-end QRT is due. Does the own-funds mix still cover the SCR once the IFRS 17 bridge lands?
Run the AINumbers MCP tool `run_chain` with {"chain":"solvency-ii-reconciliation-and-capital"} and read `art-180-solvency2-scr-ratio-calculator.scr_breached`.
Re-run with `inputs` for `art-180-solvency2-scr-ratio-calculator`, reusing the values that result echoed, with `capital` changed so eligible_own_funds 200, tier1_unrestricted 50, tier1_restricted 50, tier2 100, tier3 0, scr 1000, mcr 250. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/solvency-ii-reconciliation-and-capital.html
