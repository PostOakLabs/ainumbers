# Robinhood Chain Regime Mapping

Single-step chain mapping the regulatory regime implied by a Robinhood Chain stock-token characterization, inverting the MiCA/GENIUS assumption that applies to the estate's other digital-asset-rail chains.

- Page: https://ainumbers.co/chaingraph/chains/rhc-regime-mapping.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-regime-mapping.md

## Workflow chain: Robinhood Chain Regime Mapping

Single-step chain mapping the regulatory regime implied by a Robinhood Chain stock-token characterization, inverting the MiCA/GENIUS assumption that applies to the estate's other digital-asset-rail chains.

Domain: Digital-Asset Rails

### Steps

1. art-318-rhc-regime-mapper
   regime_tree, mica_carveout_applies, and us_persons_gate_violated feed the regime record.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
