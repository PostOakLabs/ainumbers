# IPE Integrity Verifier

Verifies Information-Produced-by-Entity (IPE) completeness and accuracy for SOX 404 / ICFR control testing - is this report extract what the source system actually produced. Reconciles a caller-declared source-extract hash, row count, and control total against the same facts for the report built from it, within a caller-set rounding tolerance. All facts are policy inputs; the kernel never re-derives the extract, only reconciles the declared parameters into a confirmed/exception verdict with a discrepancy list. Deterministic equality and tolerance checks only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.md
- MCP tool: verify_ipe_integrity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- report_control_total (unknown, required)
- report_hash (unknown, required)
- report_row_count (unknown, required): Count
- source_control_total (unknown, required)
- source_extract_hash (unknown, required)
- source_row_count (unknown, required): Count
- tolerance (unknown, required)

## Outputs

- control_total_delta (integer, optional)
- discrepancies (array, optional)
- hash_match (boolean, optional)
- integrity_status (string, optional)
- report_control_total (integer, optional)
- report_hash (string, optional)
- report_row_count (integer, optional)
- row_count_match (boolean, optional)
- source_control_total (integer, optional)
- source_extract_hash (string, optional)
- source_row_count (integer, optional)
- tolerance (number, optional)
- total_within_tolerance (boolean, optional)

## Sample

```json
{
  "source_extract_hash": "sha256:aaa111",
  "report_hash": "sha256:aaa111",
  "source_row_count": 1000,
  "report_row_count": 1000,
  "source_control_total": 500000,
  "report_control_total": 500000,
  "tolerance": 0.01
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_ipe_integrity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
