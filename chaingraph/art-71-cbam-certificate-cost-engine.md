# CBAM Certificate Cost & Free-Allocation Engine

Converts embedded emissions into a CBAM certificate liability: applies the CBAM factor (free-allocation phase-out 2.5% 2026 to 100% 2034), deducts origin carbon price already paid, and projects the quarterly holding and surrender schedule to the 30 Sep deadline.

- Page: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.md
- MCP tool: model_cbam_certificate_cost (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cbam_factor_year (any, optional): type not evidenced by kernel source
- embedded_emissions_tco2e (any, optional): type not evidenced by kernel source
- eua_reference_price (any, optional): type not evidenced by kernel source
- import_schedule (any, optional): type not evidenced by kernel source
- origin_carbon_price_eur_per_t (any, optional): type not evidenced by kernel source

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
{}
```

## Verify

Run the sample policy_parameters through MCP tool `model_cbam_certificate_cost` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
