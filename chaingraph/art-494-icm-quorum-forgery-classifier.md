# ICM Quorum Forgery Classifier

Computes the smallest set of a source Avalanche L1's validators that could jointly sign an Interchain Messaging (ICM / Avalanche Warp Messaging) message the receiving L1 would accept: sorts the caller-transcribed stake weights descending, prefix-sums them, and returns the count at which the receiving chain's accepted stake-weight quorum is first satisfied, alongside that group's cumulative share, an HHI-style stake concentration figure, and a verdict against a caller-declared minimum-colluding floor. Quorum semantics follow avalanchego's Warp signature check (signed weight times 100 greater than or equal to total weight times the quorum percentage), evaluated cross-multiplied so no division rounding moves the boundary. The accepted quorum is a caller input with no baked-in default threshold, because it is the receiving chain's own acceptance policy for that source rather than a statutory number, following the precedent art-445 sets by refusing to bake in a concentration limit. Avalanche finality is sub-second with no reorg window, so the challenge-window arithmetic that applies to optimistic bridges does not transfer; this node picks up where that risk relocates, namely who signed the cross-chain message. Borrows only the art-445 helper pattern (fixed-point 2dp rounding, share-of-total, finite gate, NaN-safe coercion); art-445 computes top-N and per-sector rollups and does not compute a minimum-colluding set. Observes no chain: no RPC call and no P-Chain query, with the validator set transcribed by the caller as opaque identifiers. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.md
- MCP tool: check_icm_quorum_forgery_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- message_class (unknown, required)
- min_colluding_floor (unknown, required)
- quorum_pct (unknown, required): Percentage value
- source_l1_label (unknown, required)
- validator_weights (array, required)

## Outputs

- colluding_share_pct (integer, optional)
- colluding_stake_weight (integer, optional)
- meets_floor (boolean, optional)
- message_class (string, optional)
- min_colluding_floor (integer, optional)
- min_colluding_validators (integer, optional)
- quorum_pct (integer, optional)
- quorum_pct_valid (boolean, optional)
- quorum_reachable (boolean, optional)
- rationale (array, optional)
- source_l1_label (string, optional)
- stake_hhi (integer, optional)
- total_stake_weight (integer, optional)
- total_validators (integer, optional)

## Sample

```json
{
  "validator_weights": [
    {
      "validator_id": "V-01",
      "weight": 4000
    },
    {
      "validator_id": "V-02",
      "weight": 2500
    },
    {
      "validator_id": "V-03",
      "weight": 1200
    },
    {
      "validator_id": "V-04",
      "weight": 900
    },
    {
      "validator_id": "V-05",
      "weight": 700
    },
    {
      "validator_id": "V-06",
      "weight": 400
    },
    {
      "validator_id": "V-07",
      "weight": 300
    }
  ],
  "quorum_pct": 67,
  "min_colluding_floor": 4,
  "source_l1_label": "Source L1 Alpha",
  "message_class": "token-transfer"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_icm_quorum_forgery_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
