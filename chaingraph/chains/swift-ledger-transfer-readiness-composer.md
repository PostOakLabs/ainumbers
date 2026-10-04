# Shared-Ledger Transfer Readiness Receipt

Gated four-step preflight for a shared-ledger tokenized-deposit transfer: ISO 20022-to-EVM calldata mapping, batch sanctions and purpose-code screen, L2 finality window classification, and cash-leg finality check compose into one receipt. An unmapped required field or a screening hit halts the chain before commit.

- Page: https://ainumbers.co/chaingraph/chains/swift-ledger-transfer-readiness-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/swift-ledger-transfer-readiness-composer.md

## Workflow chain: Shared-Ledger Transfer Readiness Receipt

Gated four-step preflight for a shared-ledger tokenized-deposit transfer: ISO 20022-to-EVM calldata mapping, batch sanctions and purpose-code screen, L2 finality window classification, and cash-leg finality check compose into one receipt. An unmapped required field or a screening hit halts the chain before commit.

Domain: Digital-Asset Rails

### Steps

1. art-288-map-iso20022-to-evm-calldata
   resolved_call and mapping_ok feed Stage 2 batch screening; an incomplete mapping stops the chain
2. art-291-screen-onledger-transfer-batch
   batch_clean feeds Stage 3 finality classification; a screening hit stops the chain
3. art-290-check-linea-l2-finality-window
   finality_tier and safe_to_release feed Stage 4 cash-leg finality check
4. 506-onchain-cash-leg-finality-checker
   Composes the transfer-readiness receipt - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before we route this payout through the shared ledger, does the cash leg meet our finality standard?
Run the AINumbers MCP tool `run_chain` with {"chain":"swift-ledger-transfer-readiness"} and read `506-onchain-cash-leg-finality-checker.verdict`.
Re-run with `inputs` for `506-onchain-cash-leg-finality-checker`, reusing the values that result echoed, with `finality_model` set to "traditional_wire". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/swift-ledger-transfer-readiness.html
