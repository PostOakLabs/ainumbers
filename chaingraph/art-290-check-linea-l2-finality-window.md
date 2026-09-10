# Linea L2 Finality Window Classifier

Classifies a tokenized-deposit transfer’s finality risk given L2-batch to L1-settlement timing: soft (unsubmitted), batched (submitted, not yet final), or l1_final tier, reorg-window risk, and a safe-to-release verdict against a corridor policy cutoff. Fills the L2 gap classify_settlement_asset_finality does not cover. Classifies supplied state only, never observes the chain or an RPC. Draft-pinned generic optimistic/batched L2 model; Linea-specific published finality windows were not found at STEP-0 re-verify (2026-07-13). Not check_cash_leg_finality or classify_settlement_asset_finality.

- Page: https://ainumbers.co/chaingraph/art-290-check-linea-l2-finality-window.html
- Markdown twin: https://ainumbers.co/chaingraph/art-290-check-linea-l2-finality-window.md
- MCP tool: check_linea_l2_finality_window (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_type (unknown, required)
- batch_submission_status (unknown, required)
- corridor_cutoff (unknown, required)
- l1_finalization_status (unknown, required)
- l2_block (unknown, required)

## Outputs

- corridor_cutoff (string, optional)
- draft_pinned (boolean, optional)
- finality_tier (string, optional)
- rationale (array, optional)
- reorg_window_risk (string, optional)
- safe_to_release (boolean, optional)

## Sample

```json
{
  "l2_block": 1234567,
  "batch_submission_status": "submitted",
  "l1_finalization_status": "finalized",
  "corridor_cutoff": "batched",
  "asset_type": "tokenized_deposit"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_linea_l2_finality_window` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
