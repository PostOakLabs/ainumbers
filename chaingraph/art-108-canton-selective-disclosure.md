# Canton Selective-Disclosure DvP Reconciliation Attestation

Attest that a Canton DvP privacy partition is sound: each counterparty sees only its leg, no cross-leg data leaks, and both views reconcile to one shared commitment. Optional Ed25519 §​16 proof gives each party a non-repudiable attestation its partial view reconciles without seeing the counter-leg: the Canton selective-disclosure differentiator.

- Page: https://ainumbers.co/chaingraph/art-108-canton-selective-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-108-canton-selective-disclosure.md
- MCP tool: validate_canton_selective_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dvp_structure (unknown, required)

## Outputs

- bank_view_ok (boolean, optional)
- cross_leak_fields (array, optional)
- no_cross_leg_leak (boolean, optional)
- partition_attestation (string, optional)
- reconciles_to_commitment (boolean, optional)
- registrar_view_ok (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "dvp_structure": {
    "asset_leg": {
      "visible_to": [
        "registrar"
      ],
      "fields": [
        "isin",
        "quantity",
        "settlement_date"
      ]
    },
    "cash_leg": {
      "visible_to": [
        "bank"
      ],
      "fields": [
        "amount_usd",
        "value_date",
        "account_ref"
      ]
    },
    "shared_commitment": "hash:abc123def456"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_canton_selective_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
