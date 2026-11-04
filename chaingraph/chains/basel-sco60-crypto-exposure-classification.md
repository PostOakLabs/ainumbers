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

### Ask your agent

Question: Does this tokenized Treasury position keep a Group 1 risk weight under Basel SCO60, and what weight applies to it?
Run the AINumbers MCP tool `run_chain` with {"chain":"basel-sco60-crypto-exposure-classification"} and read `art-281-sco60-crypto-asset-exposure-classifier.risk_weight_applied_pct`.
Re-run with `inputs` for `art-281-sco60-crypto-asset-exposure-classifier`, reusing the values that result echoed, with `position` changed so classification is unbacked_crypto and meets_group1_conditions is false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/basel-sco60-crypto-exposure-classification.html
