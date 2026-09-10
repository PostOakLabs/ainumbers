# Basel SCO60 Crypto-Asset Exposure Classification

Single-node classifier mapping a crypto-asset position to its Basel SCO60 Group (1a/1b/2a/2b), applying the infrastructure-risk add-on and the Group 2 exposure limit check.

- Page: https://ainumbers.co/chaingraph/chains/basel-sco60-crypto-exposure-classification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/basel-sco60-crypto-exposure-classification.md

## Workflow chain: Basel SCO60 Crypto-Asset Exposure Classification

Single-node classifier mapping a crypto-asset position to its Basel SCO60 Group (1a/1b/2a/2b), applying the infrastructure-risk add-on and the Group 2 exposure limit check.

Domain: Digital-Asset Rails

### Steps

1. art-281-sco60-crypto-asset-exposure-classifier
   group, risk_weight_applied_pct, and group2_limit_breached feed the bank's SCO60 capital calculation and Pillar 3 DIS55 disclosure; standalone recurring classification per position

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
