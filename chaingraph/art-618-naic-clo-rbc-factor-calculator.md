# NAIC CLO/CBO/CDO Tranche RBC Factor Calculator

Recomputes the NAIC Life RBC per-tranche capital charge for CLO/CBO/CDO bond tranches against the LR002 Column (2) factor grid adopted by the RBC Investment Risk & Evaluation (E) Working Group (Proposal 2026-12-IRE, effective YE2026 filings). Given a tranche's NAIC designation category, BSL thin-tranche flag, current tranche thickness, and book/adjusted carrying value, looks up the correct pre-tax factor - including the flat 11.77% BSL thin-tranche surcharge for designation 2.C or below at <=4% thickness - and computes the tranche-level RBC dollar requirement (ROUND(...,0)), summed across a portfolio. Exhaustively enumerated over the declared 31-state (naic_designation x bsl_thin_override_applicable) input domain. Verify-only: recomputes a prescribed charge from declared inputs, never asserts filing compliance or correctness of the filer's own rating/thickness determination.

- Page: https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.md
- MCP tool: calculate_naic_clo_rbc_factor (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "tranches": [
    {
      "naic_designation": "1.A",
      "book_adjusted_carrying_value": 1000000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_naic_clo_rbc_factor` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
