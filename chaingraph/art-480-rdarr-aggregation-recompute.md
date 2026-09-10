# RDARR Aggregation Recompute

Re-derives a stated risk-report figure from a SUPPLIED source extract under a declared aggregation policy (filter set, netting rule, FX rate set, hierarchy roll-up). Returns the recomputed figure, a signed delta vs the reported figure, and a per-roll-up-node contribution breakdown so a break localises to one node instead of the whole report. HARD FENCE: every FX rate is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never an opinion on extract or reported-figure correctness, never a data-quality assessment (see art-481-rdarr-quality-scorecard), never a materiality judgement. First entry of the BCBS 239 / RDARR family, feeding the rdarr-attestation-cycle chain (art-481 + gate + attestation bundle). Not a data-quality scorecard or any general risk-data ingester. ECB Guide on effective risk data aggregation and risk reporting (3 May 2024) referenced as informative context only.

- Page: https://ainumbers.co/chaingraph/art-480-rdarr-aggregation-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-480-rdarr-aggregation-recompute.md
- MCP tool: rdarr_aggregation_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aggregation_policy (unknown, required)
- base_currency (unknown, optional)
- extract (array, required)
- hierarchy (array, required)
- reported_figure (unknown, required)

## Outputs

- base_currency (string, optional)
- contribution_breakdown (array, optional)
- delta (string, optional)
- delta_pct (string, optional)
- fence (string, optional)
- lines_excluded (integer, optional)
- lines_included (integer, optional)
- netting_applied (boolean, optional)
- netting_sets (array, optional)
- not_proven (array, optional)
- recomputed_figure (string, optional)
- reported_figure (string, optional)
- rounding (object, optional)

## Sample

```json
{
  "base_currency": "USD",
  "reported_figure": 5000,
  "aggregation_policy": {
    "exclude_flagged": true,
    "netting": {
      "enabled": true,
      "by": "counterparty"
    },
    "rounding": {
      "decimal_places": 2,
      "mode": "half_up"
    }
  },
  "hierarchy": [
    {
      "node_id": "ROOT",
      "parent_node_id": null,
      "label": "Total Credit Risk RWA"
    },
    {
      "node_id": "RETAIL",
      "parent_node_id": "ROOT",
      "label": "Retail"
    },
    {
      "node_id": "CORP",
      "parent_node_id": "ROOT",
      "label": "Corporate"
    }
  ],
  "extract": [
    {
      "line_id": "L1",
      "node_id": "RETAIL",
      "counterparty": "CP-A",
      "amount": 2000,
      "currency": "USD",
      "fx_rate_to_base": 1,
      "include": true
    },
    {
      "line_id": "L2",
      "node_id": "RETAIL",
      "counterparty": "CP-A",
      "amount": -500,
      "currency": "USD",
      "fx_rate_to_base": 1,
      "include": true
    },
    {
      "line_id": "L3",
      "node_id": "CORP",
      "counterparty": "CP-B",
      "amount": 3000,
      "currency": "EUR",
      "fx_rate_to_base": 1.08,
      "include": true
    },
    {
      "line_id": "L4",
      "node_id": "CORP",
      "counterparty": "CP-C",
      "amount": 400,
      "currency": "USD",
      "fx_rate_to_base": 1,
      "include": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `rdarr_aggregation_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
