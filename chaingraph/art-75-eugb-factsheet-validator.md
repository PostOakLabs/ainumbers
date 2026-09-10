# EU Green Bond Factsheet & Allocation Validator

Validates an EuGB factsheet (Annex I) + allocation report (Annex II) for completeness and the 100% Taxonomy-aligned proceeds threshold, cross-checking against ART-73 alignment of the funded activities. EuGB Reg. (EU) 2023/2631 applies since 21 Dec 2024; external-reviewer RTS 12 Mar 2026.

- Page: https://ainumbers.co/chaingraph/art-75-eugb-factsheet-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-75-eugb-factsheet-validator.md
- MCP tool: validate_eugb_factsheet (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allocation_report (unknown, optional)
- external_reviewer (unknown, optional)
- factsheet (unknown, optional)
- use_of_proceeds (unknown, optional)

## Outputs

- aligned_proceeds (integer, optional)
- annex_i_complete (boolean, optional)
- annex_i_gaps (array, optional)
- annex_ii_status (string, optional)
- conformance_grade (string, optional)
- conformance_score (integer, optional)
- external_reviewer_status (string, optional)
- label_ready (boolean, optional)
- note (string, optional)
- proceeds_aligned_pct (integer, optional)
- proceeds_threshold_met (boolean, optional)
- proceeds_threshold_pct (integer, optional)
- reference (object, optional)
- total_proceeds (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_eugb_factsheet` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
