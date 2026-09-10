# SB 53 Frontier Scope Checker

Routes supplied model compute (FLOPs, as a decimal string above the 2^53 safe-integer range) and developer annual revenue through the California SB 53 Transparency in Frontier Artificial Intelligence Act (eff. 2026-01-01) scope thresholds: 10^26 FLOP frontier-model bar and $500M large-frontier-developer revenue bar. Returns in-scope flags and the triggered obligation set (transparency report, catastrophic-risk-assessment summary, and for large frontier developers the safety-framework publication, annual update, incident reporting, and whistleblower-channel obligations). Asserts a scope/obligation finding only, never that those obligations have been fulfilled. Standalone - deliberately not folded into the CAIA/TRAIGA/AB2013 chains (narrow frontier-lab audience). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.md
- MCP tool: check_sb53_frontier_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_revenue_usd (unknown, required): Amount in US dollars
- compute_flops (unknown, required)

## Outputs

- compute_flops (string, optional)
- flop_threshold (string, optional)
- is_frontier_model (boolean, optional)
- is_large_frontier_developer (boolean, optional)
- large_developer_revenue_threshold_usd (integer, optional)
- obligation_set (array, optional)
- statute_citation (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_sb53_frontier_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
