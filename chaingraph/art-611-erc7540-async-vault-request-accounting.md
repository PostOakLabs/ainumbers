# ERC-7540 Async-Vault Request Accounting

Recomputes ERC-7540 asynchronous-vault request accounting from caller-declared request state. ERC-7540 (Final, Created 2023-10-18, CC0-1.0) extends ERC-4626 with a three-state request lifecycle used by institutional and real-world-asset funds that cannot settle a deposit or redemption in the same transaction: an amount is Pending after a request, becomes Claimable when the vault fulfils it, and is Claimed when the holder finally calls deposit, mint, withdraw or redeem. This node applies a sequence of claims against the claimable buckets at the pro-rata rate they were made claimable at, tracks the pending, claimable and claimed split for both legs, reports the rounding residue a sequence of partial claims strands, and checks the standard's own invariants by name: pending and claimable are disjoint views, a claim never short-circuits the Claim state, a claim never exceeds what is claimable, and a request with a non-zero requestId stays at a single pro-rata rate. ERC-7540 mandates no rounding direction for a partial claim, unlike ERC-4626 which fixes one per function, so the direction here is a declared parameter and the result of the opposite direction is reported beside it rather than a direction being presented as required. All arithmetic is exact uint256 integer math with no floating point. This node never reads any chain: it cannot know whether the declared amounts match a deployed vault, when or whether a pending request will be fulfilled, whether the controller is authorised, or whether a claim transaction would succeed.

- Page: https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.html
- Markdown twin: https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.md
- MCP tool: recompute_erc7540_request_accounting (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- request_id (string, optional)
- deposit (object, optional)
- redeem (object, optional)
- claims (array, optional)
- claim_rounding (string, optional)
- chain_id (string, optional)
- network_label (string, optional)

## Outputs

- declared_context (object, optional)
- request_id (string,null, optional)
- aggregate_by_controller (boolean,null, optional)
- claim_rounding_used (string,null, optional)
- opening (object,null, optional)
- claims (array, optional)
- closing (object,null, optional)
- dust (object, optional)
- invariants (array, optional)
- note (string, optional)
- reasons (array, optional)

## Sample

```json
{
  "request_id": "0",
  "deposit": {
    "pending_assets": "500",
    "claimable_assets": "1000",
    "claimable_shares": "333"
  },
  "claims": [
    {
      "leg": "deposit",
      "unit": "requested",
      "amount": "300"
    },
    {
      "leg": "deposit",
      "unit": "requested",
      "amount": "700"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_erc7540_request_accounting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
