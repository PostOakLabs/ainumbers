# Validator Change-Control Receipt

Turns one permissioned-validator event on an Avalanche Evergreen L1 - a validator add, remove, or weight change - into change-control evidence in the shape the SOX/ICFR control family already uses: the authorization chain of named identities, the weight delta and its share-of-total effect against a caller-supplied total network stake, and a quorum verdict comparing the caller's declared approval-quorum policy against what the caller states was achieved, plus a structural exceptions list (nonzero prior weight on an add, nonzero posterior weight on a remove, no delta on a weight change, an unauthorized change, an achieved-quorum count exceeding the number of named authorizers). Fail-closed on required inputs: a missing or null prior_weight or posterior_weight is no statement at all and never reads as a stated zero (which would silently encode a from-zero add or a slash-to-zero), a missing or blank as_of never records undated evidence, and a missing quorum number leaves the quorum UNQUANTIFIED rather than met; every required-field deletion raises an exception and escalates. Statedness is strict: a weight, the total stake or a quorum number counts as a statement only as a finite number or one strict decimal-string form (the tool page sends DOM input strings), so an empty string, a blank, a boolean, an array or a junk string refuses NOT_STATED (never a coerced stated zero, an unstated field echoes as null and no delta or share is derived from it), a negative refuses NEGATIVE (never clamped, so no silent from-zero add or slash-to-zero), quorum counts must additionally be whole numbers, and as_of, effective_epoch and validator_ref must be non-empty strings (a non-string scalar is a missing statement, never coerced into a present one). No baked-in quorum threshold: quorum_required is the caller's own policy for that Evergreen L1, exactly as art-445/art-494 refuse to bake in their own thresholds. No chain observation, no P-Chain query, no RPC: the event is transcribed by the caller. Not X: use art-503 for a §27 dual-control certification that counts distinct approvers against a statutory-or-policy threshold across a subject; this node evidences one validator-set change event, not an approval-count certification. compliance_control. Zero PII: validator_ref and every authorizing identity are opaque references. Input truthfulness is strict: an as_of that is not a real calendar date in exact YYYY-MM-DD form (an impossible day, month or zero date) refuses AS_OF_INVALID_DATE and is never recorded as the receipt date, an integer magnitude beyond 2^53 refuses UNSAFE_INTEGER and echoes null (its JSON round-trip already prints a different number, and it is carried as null in the artifact preimage so the receipt never launders an unrepresentable value), only real non-empty strings are authorizing identities (a number, boolean, object or array entry refuses AUTHORIZING_IDENTITY_NOT_A_STRING and is never coerced into the chain or counted toward quorum), and change_type is an exact allowlist match where padding is a different value, not a tolerated one.

- Page: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.md
- MCP tool: build_validator_change_control_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (any, required): type not evidenced by kernel source
- authorizing_identities (array, required)
- change_type (any, required): type not evidenced by kernel source
- effective_epoch (any, required): type not evidenced by kernel source
- posterior_weight (any, required): type not evidenced by kernel source
- prior_weight (any, required): type not evidenced by kernel source
- quorum_achieved (any, required): type not evidenced by kernel source
- quorum_required (any, required): type not evidenced by kernel source
- total_stake_weight (any, required): type not evidenced by kernel source
- validator_ref (any, required): type not evidenced by kernel source

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
