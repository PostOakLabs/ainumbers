# ERC-4626 Vault Share Math

Recomputes ERC-4626 tokenized-vault share and asset conversions from caller-declared vault state (total_assets, total_supply, optional virtual-amounts offset), applying the rounding direction the standard mandates for each function and reporting which direction produced each result alongside what the opposite direction would have produced. ERC-4626 (Final, Created 2021-12-22, CC0-1.0) fixes those directions per function: convertToShares and convertToAssets round down towards 0, previewDeposit returns no more than the shares a deposit would mint and previewRedeem no more than the assets a redeem would withdraw (both round down), while previewMint returns no fewer than the assets a mint would deposit and previewWithdraw no fewer than the shares a withdraw would burn (both round up). Getting one direction backwards is how a vault leaks value, so each is checked separately. Also computes a deposit-then-redeem round-trip loss bound against the post-deposit state, a signed exchange-rate drift between two declared snapshots, and a declared fee application. All arithmetic is exact uint256 integer math with no floating point. This node never reads any chain: it cannot know whether the declared totals match a deployed vault, whether that vault applies these directions, or whether a rate change came from yield, loss, a donation, or an attack.

- Page: https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html
- Markdown twin: https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.md
- MCP tool: recompute_erc4626_vault_share_math (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- total_assets (string, optional)
- total_supply (string, optional)
- virtual_amounts (boolean, optional)
- decimals_offset (string, optional)
- operations (array, optional)
- round_trip_assets (string, optional)
- snapshot_b (object, optional)
- fee_bps (string, optional)
- fee_basis (string, optional)
- chain_id (string, optional)
- network_label (string, optional)

## Outputs

- declared_context (object, optional)
- vault_state (object,null, optional)
- conversions (array, optional)
- fee (object,null, optional)
- round_trip (object,null, optional)
- rate_drift (object,null, optional)
- rounding_table (array, optional)
- note (string, optional)
- reasons (array, optional)

## Sample

```json
{
  "total_assets": "1000000000000000000000",
  "total_supply": "333000000000000000000",
  "chain_id": "1",
  "network_label": "declared label, not a selector",
  "operations": [
    {
      "op": "convertToShares",
      "amount": "1000"
    },
    {
      "op": "convertToAssets",
      "amount": "1000"
    },
    {
      "op": "previewDeposit",
      "amount": "1000"
    },
    {
      "op": "previewMint",
      "amount": "1000"
    },
    {
      "op": "previewWithdraw",
      "amount": "1000"
    },
    {
      "op": "previewRedeem",
      "amount": "1000"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_erc4626_vault_share_math` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
