# Record Index Correction

art-557 already covers constituent-set corrections via the SPEC.md top-level supersedes field; this node adds the equivalent for a published index level or weight-set value, the case BMR calls an index restatement: a level or weight was published, then found wrong, and corrected. HARD FENCE: this kernel attests THAT a correction was declared, by whom (the caller-supplied original_value_ref), and why (reason_code); it does not itself verify the corrected value against a third-party recomputation, and it creates no reverse link or status registry, SPEC.md §1 is explicit that supersession is discoverable only from the newer artifact or a log scan. Fourth entry of the Financial Index/Benchmark Administrator Lineage family. Two separate regimes, cited separately: EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1)(e) (traceable and verifiable) is the cited traceability rationale; SEBI (Index Providers) Regulations, 2024 was searched and has no located provision governing correction or restatement of a published index value, recorded here as an explicit N/A, not silently inherited. This kernel makes no compliance claim under either regime.

- Page: https://ainumbers.co/chaingraph/art-647-record-index-correction.html
- Markdown twin: https://ainumbers.co/chaingraph/art-647-record-index-correction.md
- MCP tool: record_index_correction (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "index_id": "IDX-DEMO-100",
  "original_value_ref": {
    "execution_hash": "sha256:eee555",
    "tool_id": "art-645-compute-index-weights",
    "field_path": "output_payload.weights[0].weight"
  },
  "corrected_value": 0.62,
  "reason_code": "input data error",
  "correction_date": "2026-08-10",
  "affected_period": "2026-08-05"
}
```

## Verify

Run the sample policy_parameters through MCP tool `record_index_correction` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
