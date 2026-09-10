# IHB Interest Allocation

Allocates overnight in-house-bank (IHB) interest across notional pool or ZBA sweep members. OECD Transfer Pricing Guidelines 2022 Chapter X arm's-length rate. Supports ACT/360, ACT/365, and 30/360 day-count conventions. Per-member withholding tax deduction. Returns per-member gross_interest, withholding_amount, net_interest, and total_interest_allocated. ZERO PII: member IDs are entity references only, no personal account-holder data.

- Page: https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.html
- Markdown twin: https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.md
- MCP tool: allocate_ihb_interest (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- arm_length_rate (unknown, required)
- base_currency (unknown, required)
- day_count_convention (unknown, required)
- days (unknown, required)
- pool_members (array, required)
- pool_type (unknown, required)

## Outputs

- allocations (array, optional)
- arm_length_rate (number, optional)
- base_currency (string, optional)
- day_count_convention (string, optional)
- day_count_fraction (number, optional)
- days (integer, optional)
- entity_count (integer, optional)
- net_interest_payable (integer, optional)
- not_legal_advice (string, optional)
- oecd_tp_compliant (boolean, optional)
- pii_note (string, optional)
- pool_net_balance (integer, optional)
- pool_type (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_interest_allocated (integer, optional)

## Sample

```json
{
  "pool_type": "notional",
  "arm_length_rate": 0.05,
  "days": 30,
  "day_count_convention": "ACT/360",
  "base_currency": "USD",
  "pool_members": [
    {
      "entity_id": "PARENT_CO",
      "balance": 500000,
      "withholding_rate": 0
    },
    {
      "entity_id": "SUB_A",
      "balance": -200000,
      "withholding_rate": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `allocate_ihb_interest` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
