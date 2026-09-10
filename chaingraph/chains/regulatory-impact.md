# Regulatory Impact to Policy Mandate

Regulatory change impact assessment > NIS2/DORA overlap mapping > AP2 DORA Policy Mandate.

- Page: https://ainumbers.co/chaingraph/chains/regulatory-impact.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/regulatory-impact.md

## Workflow chain: Regulatory Impact to Policy Mandate

Regulatory change impact assessment > NIS2/DORA overlap mapping > AP2 DORA Policy Mandate.

Domain: Financial Crime & KYC

### Steps

1. 318-regulatory-change-impact-assessor
   impact_domains and change_timeline feed T309 NIS2/DORA overlap map
2. 309-nis2-dora-overlap-mapper
   overlap_matrix and dual_obligations feed T310 policy mandate build
3. 310-ap2-dora-policy-mandate-builder
   Exports regulatory impact Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
