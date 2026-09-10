# Record Index Constituents

Gives an index's constituent set, as of a stated date, its own citable execution_hash - the BMR/SEBI-shaped starting point ('what was in the index and why') that every downstream weighting or rebalance artifact cites rather than re-declaring. Attests that a declared constituent set exists exactly as stated, selected under a stated eligibility-criteria description, over caller-supplied constituent rows (security_id, name, sector, country) and a declared selection universe size. HARD FENCE: every constituent row and the eligibility-criteria description are supplied and asserted, never fetched (zero-egress); this attests THAT a declared set exists as stated, never whether the criteria was correctly applied against underlying market data, never a live index-provider feed. First entry of the Financial Index/Benchmark Administrator Lineage family, alongside the forthcoming compute_index_weights, compile_rebalance_evidence_pack and record_index_correction. Not fund NAV recomputation (art-373) or any benchmark-publisher scorecard. Corrections cite the prior artifact via the SPEC.md top-level supersedes field, not a bespoke status registry. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) and SEBI benchmark-administrator framework citations informative only.

- Page: https://ainumbers.co/chaingraph/art-557-record-index-constituents.html
- Markdown twin: https://ainumbers.co/chaingraph/art-557-record-index-constituents.md
- MCP tool: record_index_constituents (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, optional)
- constituents (array, required)
- eligibility_criteria_ref (unknown, optional)
- index_id (unknown, optional)
- selection_universe_size (unknown, required)

## Outputs

- as_of_date (string, optional)
- constituent_count (integer, optional)
- constituents (array, optional)
- eligibility_criteria_ref (string, optional)
- fence (string, optional)
- index_id (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- selection_universe_size (integer, optional)
- structural_error (string, optional)

## Sample

```json
{
  "index_id": "IDX-DEMO-100",
  "as_of_date": "2026-08-05",
  "constituents": [
    {
      "security_id": "SEC-A",
      "name": "Alpha Corp",
      "sector": "Industrials",
      "country": "US"
    },
    {
      "security_id": "SEC-B",
      "name": "Beta Ltd",
      "sector": "Financials",
      "country": "GB"
    },
    {
      "security_id": "SEC-C",
      "name": "Gamma SA",
      "sector": "Materials",
      "country": "FR"
    }
  ],
  "eligibility_criteria_ref": "market-cap rank <=200, free-float >=15%, ADV >= threshold",
  "selection_universe_size": 200
}
```

## Verify

Run the sample policy_parameters through MCP tool `record_index_constituents` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
