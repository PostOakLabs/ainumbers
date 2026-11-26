# Robinhood Chain Multiplier Reconciliation

Single-step chain reconciling a declared Robinhood Chain stock-token corporate action against its ERC-8056 uiMultiplier transition, event log, and raw-balance invariance.

- Page: https://ainumbers.co/chaingraph/chains/rhc-multiplier-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-multiplier-reconciliation.md

## Workflow chain: Robinhood Chain Multiplier Reconciliation

Single-step chain reconciling a declared Robinhood Chain stock-token corporate action against its ERC-8056 uiMultiplier transition, event log, and raw-balance invariance.

Domain: Digital-Asset Rails

### Steps

1. art-317-rhc-multiplier-reconciler
   verdict, ratio_match, raw_balance_invariant, and discrepancies feed the reconciliation record.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A split event just applied to the token. Does the recorded supply multiplier reconcile with the declared corporate action?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-multiplier-reconciliation"} and read `art-317-rhc-multiplier-reconciler.verdict`.
Re-run with `inputs` for `art-317-rhc-multiplier-reconciler`, reusing the values that result echoed, with `current_multiplier` set to 4. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-multiplier-reconciliation.html
