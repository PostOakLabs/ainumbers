# Multilateral Cash Netting

Computes N-entity corporate cash netting: gross inter-company positions to net positions to minimum settlement legs using the BIS CPMI greedy matching algorithm (Net Settlement Framework 2012). Reports wire-count savings and netting_efficiency_pct. Corporate cash netting only - NOT estimate_ficc_margin_netting (FICC US-Treasury clearing). Netting statement suitable for anchor_batch Merkle-leaf receipts. ZERO PII: aggregate entity balances only, no account-holder identifiers.

- Page: https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.html
- Markdown twin: https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.md
- MCP tool: compute_multilateral_netting (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- base_currency (unknown, required)
- entities (array, required)
- fx_rates (unknown, required)
- gross_positions (array, required)

## Outputs

- anchor_surface (string, optional)
- base_currency (string, optional)
- entity_count (integer, optional)
- entity_net_positions (array, optional)
- gross_count (integer, optional)
- gross_volume (integer, optional)
- net_count (integer, optional)
- net_volume (integer, optional)
- netting_efficiency_pct (number, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- settlement_legs (array, optional)
- table_source (string, optional)
- table_version (string, optional)
- wire_count_savings (integer, optional)
- wire_count_savings_pct (number, optional)

## Sample

```json
{
  "base_currency": "USD",
  "entities": [
    {
      "entity_id": "ENTITY_A",
      "name": "Parent Co"
    },
    {
      "entity_id": "ENTITY_B",
      "name": "Sub US"
    },
    {
      "entity_id": "ENTITY_C",
      "name": "Sub EU"
    }
  ],
  "gross_positions": [
    {
      "from_entity": "ENTITY_A",
      "to_entity": "ENTITY_B",
      "amount": 1000,
      "currency": "USD"
    },
    {
      "from_entity": "ENTITY_B",
      "to_entity": "ENTITY_C",
      "amount": 800,
      "currency": "USD"
    },
    {
      "from_entity": "ENTITY_C",
      "to_entity": "ENTITY_A",
      "amount": 600,
      "currency": "USD"
    }
  ],
  "fx_rates": {}
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_multilateral_netting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
