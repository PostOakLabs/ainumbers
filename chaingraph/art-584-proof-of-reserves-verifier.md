# Proof-of-Reserves Verifier

Independently recomputes an exchange or custodian's published Proof-of-Reserves data: a single-leaf Merkle-sum inclusion path, a liability-side Merkle-sum branch aggregation, and a coverage ratio between the two recomputed sums, with an optional cross-check against a caller-declared published reserve figure. Emits a per-check finding (reserve_inclusion, liability_aggregation, coverage_ratio) plus an overall CONSISTENT, INCONSISTENT, or INDETERMINATE determination. Generic Merkle-sum schema only; named-exchange export formats are a documented field-mapping reference in the page copy, not a standing per-exchange adapter. Mirrors the shipped art-280 reserve-proof-verifier (single-leaf inclusion) and art-540 por-liabilities-composer (composes a caller-asserted liabilities total); this node independently recomputes both sides from raw Merkle-sum path data rather than composing a pre-verified boolean. CONSISTENT never implies solvency, audit assurance, or that the underlying published figures are truthful, only that what was published is internally consistent with itself.

- Page: https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.md
- MCP tool: verify_proof_of_reserves_consistency (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- reserve_proof (object, optional)
- liability_branch (object, optional)
- published_reserve_figures (object, optional)

## Outputs

- overall_determination (string, optional)
- findings (array, optional)
- computed_reserve_root (object,null, optional)
- declared_reserve_root (object,null, optional)
- computed_liability_root (object,null, optional)
- declared_liability_root (object,null, optional)
- coverage_ratio_pct (number,null, optional)
- reserve_figure_cross_check (object,null, optional)
- not_proven (array, optional)
- determination_note (string, optional)
- regulatory_framework (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_proof_of_reserves_consistency` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
