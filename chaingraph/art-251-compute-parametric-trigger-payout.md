# Parametric Trigger Payout Calculator

Evaluates parametric insurance triggers and computes payout amounts. Supports three trigger types: threshold (binary payout at a threshold index level), tiered (step-based payout tiers), and linear_index (proportional payout between threshold and exhaustion). Produces a tamper-evident trigger receipt suitable for anchoring at anchor.ainumbers.co/mcp as a neutral dispute artifact per IAIS ICP 19. Use in parametric-trigger-adjudication chain (gated) or cat-bond-trigger-validation chain (linear). ZERO PII: index values, thresholds, and coverage amounts only.

- Page: https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html
- Markdown twin: https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.md
- MCP tool: compute_parametric_trigger_payout (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- coverage_amount (unknown, required)
- index_value (unknown, required)
- max_index (unknown, required)
- parametric_limit (unknown, required)
- threshold (unknown, required)
- tier_table (array, required)
- trigger_type (unknown, required)

## Outputs

- anchor_surface (string, optional)
- coverage_amount (integer, optional)
- index_value (integer, optional)
- not_legal_advice (string, optional)
- parametric_limit (integer, optional)
- payout_amount (integer, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- threshold_used (integer, optional)
- tier_matched_index (string, optional)
- trigger_fraction (integer, optional)
- trigger_hit (boolean, optional)
- trigger_receipt (object, optional)
- trigger_type_used (string, optional)

## Sample

```json
{
  "trigger_type": "threshold",
  "index_value": 120,
  "threshold": 100,
  "coverage_amount": 50000,
  "parametric_limit": 50000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_parametric_trigger_payout` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
