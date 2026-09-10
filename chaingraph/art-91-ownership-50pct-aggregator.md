# Ownership 50%-Rule Aggregator

Walks a synthetic ownership graph; computes direct + indirect + aggregate listed stakes per node; applies OFAC, EU, and BIS Affiliates Rule (in force 29 Sep 2025) 50%-thresholds to determine constructively-blocked entities. Ownership percentage is the only relation the inputs carry: there is no control edge and no control flag, so control without ownership is excluded from scope. OFAC FAQs 398 and 400 treat an entity that a blocked person controls without owning 50 percent or more as not itself blocked while still counselling caution, and that branch is not evaluated here. The EU criterion is ownership or control, and the eu_50 threshold expresses its ownership prong only; the EU control prong is excluded on the same ground. Pure graph math, synthetic entities only.

- Page: https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.md
- MCP tool: aggregate_ownership_50pct (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ownership_graph (unknown, optional)
- thresholds (unknown, optional)

## Outputs

- blocked_count (integer, optional)
- entity_verdicts (array, optional)
- listed_entity_count (integer, optional)
- note (string, optional)
- reference_version (string, optional)
- summary (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_ownership_50pct` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
