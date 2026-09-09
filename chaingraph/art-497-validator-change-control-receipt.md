# Validator Change-Control Receipt

Turns one permissioned-validator event on an Avalanche Evergreen L1 - a validator add, remove, or weight change - into change-control evidence in the shape the SOX/ICFR control family already uses: the authorization chain of named identities, the weight delta and its share-of-total effect against a caller-supplied total network stake, and a quorum verdict comparing the caller's declared approval-quorum policy against what the caller states was achieved, plus a structural exceptions list (nonzero prior weight on an add, nonzero posterior weight on a remove, no delta on a weight change, an unauthorized change, an achieved-quorum count exceeding the number of named authorizers). No baked-in quorum threshold: quorum_required is the caller's own policy for that Evergreen L1, exactly as art-445/art-494 refuse to bake in their own thresholds. No chain observation, no P-Chain query, no RPC: the event is transcribed by the caller. Not X: use art-503 for a §27 dual-control certification that counts distinct approvers against a statutory-or-policy threshold across a subject; this node evidences one validator-set change event, not an approval-count certification. compliance_control. Zero PII: validator_ref and every authorizing identity are opaque references.

- Page: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.md
- MCP tool: build_validator_change_control_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- authorizing_identities (array, required)
- change_type (unknown, required)
- effective_epoch (unknown, required)
- posterior_weight (unknown, required)
- prior_weight (unknown, required)
- quorum_achieved (unknown, required)
- quorum_required (unknown, required)
- total_stake_weight (unknown, required)
- validator_ref (unknown, required)

## Outputs

- as_of (string, optional)
- authorization_chain (array, optional)
- authorized (boolean, optional)
- change_type (string, optional)
- change_type_valid (boolean, optional)
- effective_epoch (string, optional)
- exceptions (array, optional)
- posterior_weight (integer, optional)
- prior_weight (integer, optional)
- quorum_achieved (integer, optional)
- quorum_required (integer, optional)
- quorum_status (string, optional)
- share_of_total_pct (number, optional)
- total_stake_weight (integer, optional)
- validator_ref (string, optional)
- weight_delta (integer, optional)

## Sample

```json
{
  "validator_ref": "VAL-07",
  "change_type": "weight_change",
  "prior_weight": 1200,
  "posterior_weight": 1500,
  "total_stake_weight": 50000,
  "authorizing_identities": [
    "ID-A",
    "ID-B",
    "ID-C"
  ],
  "quorum_required": 3,
  "quorum_achieved": 3,
  "effective_epoch": "epoch-4821",
  "as_of": "2026-07-30"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_validator_change_control_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
