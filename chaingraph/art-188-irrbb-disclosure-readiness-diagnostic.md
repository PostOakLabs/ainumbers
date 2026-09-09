# IRRBB Disclosure Readiness Diagnostic

A-F IRRBB disclosure readiness diagnostic across five dimensions: EVE shock calculation performed, SOT (EVE + NII) evaluated, standardised approach mapped, CSRBB scope assessed, and Pillar 3 IRRBB1 disclosure template ready. Returns readiness_grade (A-F), readiness_score (0-100), dimensions_met, and gaps list. Terminal node of the irrbb-measurement-and-disclosure chain. BCBS d368 + EBA GL/2022/14 + Pillar 3 IRRBB1. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.md
- MCP tool: run_irrbb_disclosure_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity (unknown, optional)

## Outputs

- dimensions_met (integer, optional)
- dimensions_total (integer, optional)
- fully_ready (boolean, optional)
- gaps (array, optional)
- readiness_grade (string, optional)
- readiness_score (integer, optional)

## Sample

```json
{
  "entity": {
    "eve_shock_calculated": true,
    "sot_eve_nii_evaluated": true,
    "standardised_approach_mapped": true,
    "csrbb_scope_assessed": true,
    "pillar3_irrbb1_ready": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_irrbb_disclosure_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
