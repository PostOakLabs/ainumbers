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
