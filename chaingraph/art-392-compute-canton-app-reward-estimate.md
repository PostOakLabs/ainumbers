# Canton App-Reward Estimator (CIP-0104)

Estimates a Canton Network app provider's Canton Coin reward for one round under CIP-0104 (approved 2026-02-12): app rewards are proportional to confirmed envelope bytes (traffic where the app-provider party appears as confirmer) against that round's app-reward pool share of the minting curve. The pool-share schedule (62% at launch, rising to 69% at year 5, 75% at year 10) is caller-supplied and source-cited, never hard-coded to a single year. Reward side of the ledger - pairs with compute_canton_traffic_cost (art-391), which computes the fee/cost side of the same synchronizer traffic. Distinct from the shipped tokenization-readiness/DvP/allowlist Canton nodes (503/507/509), which validate settlement and counterparty structure.

- Page: https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.md
- MCP tool: compute_canton_app_reward_estimate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- app_reward_pool_share (number, optional)
- confirmed_envelope_bytes (number, optional)
- protocol_version (unknown, required)
- round_total_envelope_bytes (number, optional)
- round_total_mint_cc (number, optional)

## Outputs

- app_reward_pool_cc (integer, optional)
- app_reward_pool_share (number, optional)
- cc_reward_estimate (integer, optional)
- confirmed_envelope_bytes (integer, optional)
- confirmed_share_of_traffic (number, optional)
- disambiguation (string, optional)
- pool_share_source (string, optional)
- protocol_version (string, optional)
- round_total_envelope_bytes (integer, optional)
- round_total_mint_cc (integer, optional)

## Sample

```json
{
  "protocol_version": "3.5.5",
  "confirmed_envelope_bytes": 250000,
  "round_total_envelope_bytes": 10000000,
  "round_total_mint_cc": 50000,
  "app_reward_pool_share": 0.62
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_canton_app_reward_estimate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
