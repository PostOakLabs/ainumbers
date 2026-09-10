# Credit-Scoring AI Conformity & FRIA

W-E. Credit-scoring conformity (art-05) -> risk-class confirmation (327) -> deployer FRIA (ART-66). The Annex III credit-scoring vertical end-to-end: the single most common high-risk financial AI use case. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-credit-ai-conformity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-credit-ai-conformity.md

## Workflow chain: Credit-Scoring AI Conformity & FRIA

W-E. Credit-scoring conformity (art-05) -> risk-class confirmation (327) -> deployer FRIA (ART-66). The Annex III credit-scoring vertical end-to-end: the single most common high-risk financial AI use case. Decision-support draft.

Domain: AI Governance

### Steps

1. art-05-eu-ai-act-credit-scoring-conformity
   conformity verdict (H1) feeds the risk-class mapper
2. 327-eu-ai-act-risk-class-mapper
   risk class (H2) feeds the FRIA builder
3. art-66-fria-postmarket-monitoring-builder
   Exports composite credit-conformity artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
