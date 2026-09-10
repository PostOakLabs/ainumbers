# Settlement-Asset Backing Invariant

Checks whether value held across an issuance topology stays fully backed in aggregate, not merely per account, as balances move between caller-declared buffers. The caller names each buffer (its role, asset type, and what it backs), declares a backing-ratio requirement, per-buffer floor and ceiling, and a movement set. Evaluates the aggregate backing verdict before and after the declared movements, per-buffer floor/ceiling breaches, the thinnest safe margin per buffer, declared idle-balance cost versus declared crossing cost, and the specific movement that first breaks the invariant. Settlement-asset agnostic: the same kernel runs unchanged for centrally-issued digital cash, pooled-account-backed digital cash, and a reserve-backed stablecoin, demonstrated on fixtures with zero kernel difference. Does not sweep, net, or attest reserves, and issues no recommendation to move money.

- Page: https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.html
- Markdown twin: https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.md
- MCP tool: verify_settlement_asset_backing (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- backing_model (unknown, required)
- backing_ratio_bps (unknown, required): Amount in basis points
- buffers (array, required)
- cost_per_crossing_minor_units (unknown, required)
- idle_cost_bps (unknown, required): Amount in basis points
- movements (array, required)
- value_in_circulation_minor_units (unknown, required)

## Outputs

- aggregate_backing_after_display (string, optional)
- aggregate_backing_after_minor_units (integer, optional)
- aggregate_backing_before_display (string, optional)
- aggregate_backing_before_minor_units (integer, optional)
- as_of (string, optional)
- backing_applicable (boolean, optional)
- backing_intact_after (boolean, optional)
- backing_intact_before (boolean, optional)
- backing_model (string, optional)
- backing_ratio_bps (integer, optional)
- breaches_after (array, optional)
- breaches_before (array, optional)
- buffer_count (integer, optional)
- buffer_margins (array, optional)
- buffers (array, optional)
- crossing_cost_display (string, optional)
- crossing_cost_minor_units (integer, optional)
- crossing_count (integer, optional)
- idle_amount_minor_units (integer, optional)
- idle_cost_display (string, optional)
- idle_cost_minor_units (integer, optional)
- movement_breaks_invariant (string, optional)
- movements (array, optional)
- note (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- required_backing_display (string, optional)
- required_backing_minor_units (integer, optional)
- thinnest_buffer (object, optional)
- value_in_circulation_display (string, optional)
- value_in_circulation_minor_units (integer, optional)

## Sample

```json
{
  "as_of": "2026-08-01",
  "value_in_circulation_minor_units": 10000000,
  "backing_ratio_bps": 10000,
  "idle_cost_bps": 50,
  "cost_per_crossing_minor_units": 1500,
  "buffers": [
    {
      "buffer_id": "buffer-backing",
      "role": "backing_account",
      "asset_type": "conventional-asset",
      "backs": "circulation",
      "balance_minor_units": 6000000,
      "min_minor_units": 1000000,
      "max_minor_units": null
    },
    {
      "buffer_id": "buffer-payout",
      "role": "payout_buffer",
      "asset_type": "settlement-asset",
      "backs": "circulation",
      "balance_minor_units": 4200000,
      "min_minor_units": 500000,
      "max_minor_units": 8000000
    },
    {
      "buffer_id": "buffer-issuance",
      "role": "settlement_balance",
      "asset_type": "settlement-asset",
      "backs": "new_issuance",
      "balance_minor_units": 900000,
      "min_minor_units": 200000,
      "max_minor_units": null
    }
  ],
  "movements": [
    {
      "movement_id": "MOVE-1",
      "from": "buffer-backing",
      "to": "buffer-payout",
      "amount_minor_units": 200000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_settlement_asset_backing` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

## Workflow chain: Government Payment Lifecycle

One settlement-asset-agnostic shape for a government payment programme, from backing through disbursement to audit. Backs and issues the settlement asset, confirming the aggregate backing invariant and, only where the asset is issuer-reserve-backed, pulling its reserve facts. Collects a public-money payment once across declared rails at par. Nets the period and crosses only the residual, reported as a crossing count - skipped entirely when no netting period exists. Disburses in bulk with duplicate and split-payment integrity checks. Reconciles and attests daily. Evidences the controls with audit-trail completeness and RBAC segregation-of-duties. A central bank digital currency and a reserve-backed stablecoin run the identical chain: the settlement asset is a declared parameter, not a different shape.

Domain: Public Finance & Government Payments

### Steps

1. art-521-settlement-asset-backing-invariant
   the declared backing_model routes the chain: a reserve-backed asset falls through to its reserve facts (Stage 1b), a centrally-issued asset (backing_model=vacuous, no backing set) skips straight to Stage 2 collection
2. art-06-genius-act-reserve-attestation
   reserve-attestation precheck feeds the MiCA-style reserve disclosure check (reserve-backed path only)
3. art-512-check-mica-reserve-disclosure
   reserve disclosure verdict feeds the reserve proof-of-reserves check
4. art-280-reserve-proof-verifier
   proof-of-reserves verdict closes out the backing stage; both settlement-asset paths rejoin at Stage 2 collection
5. art-513-public-money-settlement-receipt
   single-settlement, at-par collection receipt feeds the netting stage
6. art-259-compute-multilateral-netting
   net position per entity feeds the cross-currency residual step when a netting period exists (gross_count > 0); with no netting period the chain skips straight to disbursement
7. art-368-compute-fx-netting-positions
   cross-currency residual position feeds bulk disbursement; crossing count is the cost driver reported, not a new netting node
8. art-518-bulk-disbursement-integrity
   control-total-reconciled, duplicate/split-checked disbursement run feeds the daily reconciliation attestation
9. art-516-daily-reconciliation-attestation
   reconciliation attestation, including any vanished exception, feeds the audit-trail completeness check
10. art-517-audit-trail-completeness
   audit-trail gap enumeration feeds the RBAC segregation-of-duties check - the last of the two controls-evidence steps
11. art-459-sod-matrix-check
   segregation-of-duties verdict is the terminal control evidence for this run

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
