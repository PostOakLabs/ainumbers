# Cross-Border Payment Cost Check

Recompute a cross-border B2B payment's true all-in cost in three independent stages: itemize the invoice's cost stack (FX spread, method fee, VAT/reverse-charge, documentary-credit, reconciliation) as a percentage of invoice value (ART-367), recompute the corridor's declared cost gap against the hardcoded G20/FSB roadmap targets for the declared year (ART-549), then model the same corridor on a USDC stablecoin rail to show the cheaper alternative (ART-250), closing with a session receipt aggregating the run's execution hashes (CRY-05). Every figure is caller-declared; no live FX or rate calls. Not FX advice.

- Page: https://ainumbers.co/chaingraph/chains/cross-border-payment-cost-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cross-border-payment-cost-check.md

## Workflow chain: Cross-Border Payment Cost Check

Recompute a cross-border B2B payment's true all-in cost in three independent stages: itemize the invoice's cost stack (FX spread, method fee, VAT/reverse-charge, documentary-credit, reconciliation) as a percentage of invoice value (ART-367), recompute the corridor's declared cost gap against the hardcoded G20/FSB roadmap targets for the declared year (ART-549), then model the same corridor on a USDC stablecoin rail to show the cheaper alternative (ART-250), closing with a session receipt aggregating the run's execution hashes (CRY-05). Every figure is caller-declared; no live FX or rate calls. Not FX advice.

Domain: Cross-Border & Instant Payments

### Steps

1. art-367-compute-cross-border-fees
   Itemizes the caller's cross-border B2B invoice cost stack: FX spread cost, method/correspondent fee, VAT or reverse-charge cost, documentary-credit cost, and reconciliation cost, plus total cost as a percentage of invoice value
2. art-549-g20-corridor-cost-gap
   Recomputes the caller-declared corridor cost gap in basis points against the hardcoded G20/FSB target for the declared year, with a meets_target verdict
3. art-250-model-stablecoin-corridor-economics
   Models the all-in cost of the same corridor on a USDC stablecoin rail (on-ramp, chain fee, off-ramp, FX spread, float savings) against the traditional correspondent benchmark, with break-even send amount
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My supplier invoiced $10,000 from Germany with a 1.5% FX spread and $25 wire fee. What is the true all-in cost and does the corridor meet the G20 target?
Run the AINumbers MCP tool `run_chain` with {"chain":"cross-border-payment-cost-check"} and read `art-367-compute-cross-border-fees.total_cost`.
Re-run with `inputs` for `art-367-compute-cross-border-fees`, reusing the values that result echoed, with `fx_spread_bps` set to 300. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cross-border-payment-cost-check.html
