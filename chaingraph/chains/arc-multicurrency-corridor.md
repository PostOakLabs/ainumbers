# Arc Multi-Currency Corridor Jurisdiction & Settlement

Route a multi-currency Arc corridor to its per-currency home regimes and validate cross-currency settlement and Travel Rule: compliance layer, no FX economics. Per-currency jurisdiction/regime router across the partner-stablecoin set (art-111) → multi-currency PvP atomicity (511) → cross-border Travel-Rule batch validation (art-104). FX pricing is handled separately by the Arc StableFX economics chain.

- Page: https://ainumbers.co/chaingraph/chains/arc-multicurrency-corridor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-multicurrency-corridor.md

## Workflow chain: Arc Multi-Currency Corridor Jurisdiction & Settlement

Route a multi-currency Arc corridor to its per-currency home regimes and validate cross-currency settlement and Travel Rule: compliance layer, no FX economics. Per-currency jurisdiction/regime router across the partner-stablecoin set (art-111) → multi-currency PvP atomicity (511) → cross-border Travel-Rule batch validation (art-104). FX pricing is handled separately by the Arc StableFX economics chain.

Domain: Digital-Asset Rails

### Steps

1. art-111-arc-corridor-jurisdiction-router
   per-leg home regimes and disclosure gaps feed Stage 2 PvP validation
2. 511-multi-currency-pvp-validator
   multi-leg PvP atomicity verdict feeds Stage 3 Travel-Rule batch
3. art-104-tfr-travel-rule-batch-validator
   Exports composite multi-currency corridor artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Two stablecoin legs make up the corridor, each under its own regime. Which required disclosures is a leg still missing before the routing verdict?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-multicurrency-corridor"} and read `art-111-arc-corridor-jurisdiction-router.disclosure_gaps`.
Re-run with `inputs` for `art-111-arc-corridor-jurisdiction-router`, reusing the values that result echoed, with `corridor_legs` changed so the EURC leg drops its AML program disclosure. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-multicurrency-corridor.html
