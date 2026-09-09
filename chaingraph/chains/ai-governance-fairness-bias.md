# Fair-Lending & AI Bias Assessment

W-C. Fair-lending / bias assessment (452) -> the credit model under test (ml-02) -> subgroup/outlier performance anomaly (ml-01). Article 10 data-governance + non-discrimination evidence for a high-risk credit model.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-fairness-bias.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-fairness-bias.md

## Workflow chain: Fair-Lending & AI Bias Assessment

W-C. Fair-lending / bias assessment (452) -> the credit model under test (ml-02) -> subgroup/outlier performance anomaly (ml-01). Article 10 data-governance + non-discrimination evidence for a high-risk credit model.

Domain: AI Governance

### Steps

1. 452-fair-lending-ai-bias-assessment
   bias findings (H1) feed the credit scorer
2. ml-02-credit-default-risk-scorer
   model performance (H2) feeds the anomaly detector
3. ml-01-isolation-forest
   Exports composite fairness artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
