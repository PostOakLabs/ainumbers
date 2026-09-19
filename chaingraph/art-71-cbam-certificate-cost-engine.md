# CBAM Certificate Cost & Free-Allocation Engine

Converts embedded emissions into a CBAM certificate liability: screens the 50 tonne mass-based de minimis exemption, applies the CBAM factor (free-allocation phase-out 2.5% 2026 to 100% 2034), deducts origin carbon price already paid, prices 2026-vintage certificates at the quarterly average of the quarter of importation and later vintages at the weekly closing average, and projects the quarterly holding and surrender schedule to the 30 Sep deadline. The quarterly minimum holding is year-keyed: 50% of embedded emissions imported since the start of the calendar year, in force from 1 January 2027 only, with a one-quarter grace after the mass threshold is exceeded. Certificate sales begin 1 February 2027. Not modelled, and named in the omnibus_out_of_scope output field: the repurchase limit rewrite, the 2026-vintage repurchase window, and the certificate cancellation regime. The CBAM factor ramp is unaffected by Reg. (EU) 2025/2083 and is carried forward unchanged.

- Page: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.md
- MCP tool: model_cbam_certificate_cost (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_imported_net_mass_t (any, optional): type not evidenced by kernel source
- cbam_factor_year (any, optional): type not evidenced by kernel source
- cbam_sector (any, optional): type not evidenced by kernel source
- embedded_emissions_tco2e (any, optional): type not evidenced by kernel source
- eua_quarter_avg_prices (any, optional): type not evidenced by kernel source
- eua_reference_price (any, optional): type not evidenced by kernel source
- import_schedule (any, optional): type not evidenced by kernel source
- origin_carbon_price_eur_per_t (any, optional): type not evidenced by kernel source
- threshold_exceeded_quarter (any, optional): type not evidenced by kernel source

## Outputs

- cbam_factor (number, optional)
- cbam_factor_applied (number, optional)
- cbam_factor_year (integer, optional)
- certificate_liability_eur (integer, optional)
- certificates_required (integer, optional)
- eua_reference_price (integer, optional)
- free_allocation_phaseout_pct (number, optional)
- gross_liability_tco2e (integer, optional)
- net_liability_eur (integer, optional)
- note (string, optional)
- origin_price_credit (integer, optional)
- quarterly_holding_schedule (array, optional)
- reference (object, optional)
- surrender_deadline (string, optional)

## Sample

```json
{
  "embedded_emissions_tco2e": 10000,
  "cbam_factor_year": 2027,
  "origin_carbon_price_eur_per_t": 5,
  "eua_reference_price": 65,
  "import_schedule": [
    {
      "quarter": "Q1",
      "emissions": 2500
    },
    {
      "quarter": "Q2",
      "emissions": 2500
    },
    {
      "quarter": "Q3",
      "emissions": 2500
    },
    {
      "quarter": "Q4",
      "emissions": 2500
    }
  ],
  "annual_imported_net_mass_t": 12000,
  "cbam_sector": "iron_steel"
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_cbam_certificate_cost` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
