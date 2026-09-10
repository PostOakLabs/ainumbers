# DORA ICT Risk to NCA Submission

Gap analysis > resilience testing design > proportionality assessment > AP2 DORA Policy Mandate. Full orchestrated run available in the composer.

- Page: https://ainumbers.co/chaingraph/chains/dora-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-readiness.md

## Workflow chain: DORA ICT Risk to NCA Submission

Gap analysis > resilience testing design > proportionality assessment > AP2 DORA Policy Mandate. Full orchestrated run available in the composer.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. 300-dora-ict-risk-gap-analyser
   gap_findings and ict_risk_score feed T304 resilience testing design
2. 304-dora-resilience-testing-designer
   testing_plan and tlpt_scope feed T307 proportionality assessment
3. 307-dora-proportionality-assessment
   proportionality_tier and obligations feed T310 policy mandate build
4. 310-ap2-dora-policy-mandate-builder
   Exports DORA ICT risk Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
