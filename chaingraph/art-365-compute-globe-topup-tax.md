# GloBE Top-Up Tax & QDMTT Allocation Calculator

OECD Pillar Two GloBE top-up tax calculator: per-jurisdiction substance-based income exclusion (SBIE), effective tax rate (ETR), and top-up-rate/top-up-amount, then allocates the top-up across QDMTT, IIR, and UTPR, applying the OECD Side-by-Side Safe Harbour (approved/declassified 5 January 2026) when the caller declares a Central Record listing of a Qualified SbS Regime, a Filing Constituent Entity election, and a fiscal year on or after 1 January 2026 - when it applies, Top-up Tax is deemed zero for both the IIR and the UTPR. Ports the calculation from tools/473-globe-etr-jurisdiction-calculator.html and tools/474-topup-tax-qdmtt-calculator.html into one provable kernel. SBIE payroll and tangible-assets rates come from the OECD GloBE Model Rules Article 9.2 transitional schedule for fiscal years beginning 2023 through 2032 (Article 9.2 replaces the 5% of Article 5.3.3 and 5.3.4 year by year) and sit at the 5% steady state from fiscal year 2033; the payroll rate is overridable per jurisdiction and there is no assets-rate override; fiscal years before 2023 are refused fail-closed. Rates are pinned behind a constants_version field - a rate change is a version bump, never a silent recompute. Jurisdiction-level QDMTT enactment/rate and the Central Record listing are caller-supplied, never vendored.

- Page: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html
- Markdown twin: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.md
- MCP tool: compute_globe_topup_tax (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- central_record_sbs (array, required)
- fy (number, required)
- jurisdictions (array, required)
- parent_hq (any, required): type not evidenced by kernel source
- sbs_election (boolean, required)

## Outputs

- aggregate_etr (number, optional)
- central_record_sbs (array, optional)
- constants_version (string, optional)
- fy (integer, optional)
- globe_min_rate (number, optional)
- jurisdictions (array, optional)
- low_etr_count (integer, optional)
- note (string, optional)
- parent_hq (string, optional)
- regulatory_basis (string, optional)
- sbs_election (boolean, optional)
- total_iir_collected (number, optional)
- total_income (integer, optional)
- total_qdmtt_collected (number, optional)
- total_taxes (integer, optional)
- total_top_up_tax (number, optional)
- total_utpr_collected (integer, optional)
- us_exempt (boolean, optional)

## Sample

```json
{
  "parent_hq": "DE",
  "fy": 2026,
  "jurisdictions": [
    {
      "jur": "DE",
      "income": 500,
      "taxes": 70,
      "payroll": 200,
      "assets": 300,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": true,
      "qdmtt_rate": 0.15
    },
    {
      "jur": "IE",
      "income": 200,
      "taxes": 20,
      "payroll": 80,
      "assets": 100,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": true,
      "qdmtt_rate": 0.15
    },
    {
      "jur": "SG",
      "income": 150,
      "taxes": 18,
      "payroll": 60,
      "assets": 120,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": false,
      "qdmtt_rate": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_globe_topup_tax` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
