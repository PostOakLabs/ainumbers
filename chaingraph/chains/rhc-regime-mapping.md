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

### Ask your agent

Question: A stock token is characterized as a debt security issued through an SPV. Does that characterization keep it outside MiCA and inside MiFID II?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-regime-mapping"} and read `art-318-rhc-regime-mapper.mifid2_transferable_security`.
Re-run with `inputs` for `art-318-rhc-regime-mapper`, reusing the values that result echoed, with `instrument_type` set to "tokenized_equity". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-regime-mapping.html
