# x402 V2 Batch-Settlement Reconciler

Reconciles an x402 V2 batch settlement (off-chain payment vouchers vs onchain batch total), verifying recon verdict, per-voucher amounts, settlement-risk window (unredeemed voucher exposure), and computing an educational Merkle root over the voucher set. Runtime/post-trade: art-03 models V1 pre-trade; ART-61 reconciles an actual V2 batch post-settlement.

- Page: https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.md
- MCP tool: reconcile_x402_batch_settlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- batch (unknown, optional)
- finality_threshold (unknown, optional)
- tolerance_minor_units (unknown, optional)
- vouchers (unknown, optional)

## Outputs

- batch_delta_minor_units (integer, optional)
- batch_id (string, optional)
- escrow_address (string, optional)
- merkle_root_preimage (string, optional)
- note (string, optional)
- recon_verdict (string, optional)
- redeemed_count (integer, optional)
- redeemed_total (integer, optional)
- settlement_asset (string, optional)
- settlement_risk_window (integer, optional)
- status_asof (string, optional)
- unredeemed_value (integer, optional)
- voucher_count (integer, optional)
- voucher_findings (array, optional)
- within_tolerance (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_x402_batch_settlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
