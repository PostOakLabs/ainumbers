# Cross-CCP PQD Comparator

Compares a caller-selected set of CPMI-IOSCO public quantitative disclosure (PQD) fields across FICC and ICE using a manually-transcribed, source-cited fixture dataset - backtest coverage and largest margin deficiency per FICC division (GSD, MBSD, NSCC), and default fund requirement, Cover-2 peak stress loss, and total initial margin required per ICE clearing house (ICC, ICEU, ICUS), plus a CCP-level ICE skin-in-the-game total. FICC and ICE do not disclose the same field set; a field one side does not publish is reported unavailable, never interpolated. Flags a caller-declared threshold breach (e.g. Cover-2 peak stress loss exceeding a declared percentage of default fund requirement) per entity. Comparison arithmetic and delta table only - no ranking, no better/worse scoring language, no forecasting. CME and LCH are named in the spec but not built - selecting either yields an unknown-CCP rejection, never a fabricated figure. Every fixture figure is public and source-cited to the CCP's own quarterly disclosure PDF, refreshed manually per quarter, never a live feed and never scraped.

- Page: https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.md
- MCP tool: compare_cross_ccp_pqd_fields (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity_a (unknown, required)
- entity_b (unknown, required)
- fields (array, optional)
- threshold (unknown, required)

## Outputs

- cross_ccp (boolean, optional)
- entity_a (object, optional)
- entity_b (object, optional)
- fields (array, optional)
- fully_available_field_count (integer, optional)
- note (string, optional)
- partially_available_field_count (integer, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- source_citations (object, optional)
- threshold (string, optional)
- unavailable_field_count (integer, optional)

## Sample

```json
{
  "entity_a": {
    "ccp": "FICC",
    "division": "GSD"
  },
  "entity_b": {
    "ccp": "FICC",
    "division": "NSCC"
  },
  "fields": [
    "backtest_coverage_pct",
    "largest_deficiency_usd"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_cross_ccp_pqd_fields` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
