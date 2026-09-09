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
