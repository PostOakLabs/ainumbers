# Liquid-Staking Share Rate Reconciler

Recomputes the share rate of a rebasing liquid-staking token from caller-declared protocol state: internal ether (the rate numerator), internal shares (the rate denominator) and external shares. Share-to-ether and ether-to-share conversions use the internal figures and round down; wrap and unwrap amounts are reported as share conversions with a round-trip loss and its exact bound (zero up to the ceiling of internal ether over internal shares). Between consecutive declared snapshots it reports the holder balance change, including negative rebases, and the dilution from a declared count of shares minted as fees. Total shares, external ether and total pooled ether are reported as disclosure only and never enter a conversion; an optional declared total is cross-checked and any residual is reported, not refused. Operands above the 128-bit bounds, zero rate terms and zero wrap or unwrap amounts are refused. All arithmetic is exact integer math with no floating point. This node never reads any chain: it cannot know whether the declared values match a deployed token, whether a snapshot came from a real oracle report, or how external shares were minted. Fee rates, withdrawal finalization and mintable-external capacity are not modeled.

- Page: https://ainumbers.co/chaingraph/808-lst-share-rate-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/808-lst-share-rate-reconciler.md
- MCP tool: reconcile_lst_share_rate (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "holder_shares": "99000000000000000000",
  "snapshots": [
    {
      "snapshot_id": "A",
      "internal_ether": "1000000000000000000000",
      "internal_shares": "990000000000000000000",
      "external_shares": "0"
    }
  ],
  "wrap_ops": [
    {
      "snapshot_id": "A",
      "amount": "50000000000000000000"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_lst_share_rate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
