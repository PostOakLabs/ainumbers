# Settlement-Asset & Legal-Finality Classification

W-C. Settlement-asset class + legal-finality tier + singleness-of-money (ART-59) -> regulatory classification (510) -> on-chain cash-leg finality (506). Determines which settlement asset and which finality regime gate a tokenized settlement.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-settlement-asset.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-settlement-asset.md

## Workflow chain: Settlement-Asset & Legal-Finality Classification

W-C. Settlement-asset class + legal-finality tier + singleness-of-money (ART-59) -> regulatory classification (510) -> on-chain cash-leg finality (506). Determines which settlement asset and which finality regime gate a tokenized settlement.

Domain: Wholesale Settlement

### Steps

1. art-59-settlement-asset-finality-classifier
   finality_tier and singleness_verdict (H1) feed the classifier
2. 510-digital-asset-regulatory-classifier
   regulatory classification (H2) feeds the finality checker
3. 506-onchain-cash-leg-finality-checker
   Exports composite settlement-asset artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our cash leg is a deposit-style token on a public chain. Will it reach finality when the securities leg does?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-settlement-asset"} and read `506-onchain-cash-leg-finality-checker.finality_flag`.
Re-run with `inputs` for `506-onchain-cash-leg-finality-checker`, reusing the values that result echoed, with `finality_model` set to "standard_blockchain". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-settlement-asset.html
