# Commission Hierarchy Validator

BFS structural validation of multi-level sales commission hierarchies. Detects orphan agents (unreachable from root), circular references (cycle in parent chain), split-sum violations (direct-report allocations exceeding 100% of parent), and max-depth-exceeded flag. Returns is_valid (bool), violations[], and structural metrics. Accepts agent_id, parent_id, split_pct arrays. No National Producer Numbers, SSNs, or TINs. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.html
- Markdown twin: https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.md
- MCP tool: validate_commission_hierarchy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- hierarchy (unknown, optional)
- max_levels (unknown, optional)

## Outputs

- agent_count (integer, optional)
- by_level (array, optional)
- is_valid (boolean, optional)
- not_legal_advice (string, optional)
- orphan_count (integer, optional)
- override_stacking_detected (boolean, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_levels (integer, optional)
- violations (array, optional)

## Sample

```json
{
  "hierarchy": [
    {
      "agent_id": "NP1",
      "parent_id": null,
      "split_pct": null
    },
    {
      "agent_id": "ManagerA",
      "parent_id": "NP1",
      "split_pct": 60
    },
    {
      "agent_id": "AgentX",
      "parent_id": "ManagerA",
      "split_pct": 50
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_commission_hierarchy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
