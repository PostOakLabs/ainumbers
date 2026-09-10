# Fair Lending Disparity Audit

Gated two-step chain for fair lending disparate impact audit. Step 1 computes the HMDA rate spread and classifies reportability. Step 2 computes disparate impact metrics from aggregate approval counts (4/5ths rule, z-statistic, standardised mean difference). Gate: adverse_impact_ratio < 0.8 exits to remediation path (4/5ths rule violation). All inputs are aggregate counts only. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/fair-lending-disparity-audit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fair-lending-disparity-audit.md

## Workflow chain: Fair Lending Disparity Audit

Gated two-step chain for fair lending disparate impact audit. Step 1 computes the HMDA rate spread and classifies reportability. Step 2 computes disparate impact metrics from aggregate approval counts (4/5ths rule, z-statistic, standardised mean difference). Gate: adverse_impact_ratio < 0.8 exits to remediation path (4/5ths rule violation). All inputs are aggregate counts only. ZERO PII BY CONSTRUCTION.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-230-compute-hmda-rate-spread
   HMDA rate spread and reportability classification. Passes to disparity metrics computation.
2. art-229-compute-disparity-metrics
   Adverse impact ratio, z-statistic, standardised mean difference from aggregate counts. Gate: AIR < 0.8 triggers remediation flag.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
