# Art 67 Own-Funds Calculator

Computes MiCA Art 67 required own funds = higher of Annex IV permanent minimum (€50k advisory / €125k trading-platform / €150k custody-exchange) or ¼ fixed overheads. Checks CET1/insurance form eligibility.

- Page: https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.md
- MCP tool: calculate_mica_own_funds (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fixed_overheads_annual (unknown, optional)
- inputs (unknown, required)
- own_funds_form (unknown, optional)
- own_funds_held (unknown, optional)
- service_class (unknown, optional)

## Outputs

- binding_basis (string, optional)
- fixed_overheads_quarter (integer, optional)
- form_eligible (boolean, optional)
- form_note (string, optional)
- note (string, optional)
- own_funds_held (integer, optional)
- permanent_minimum (integer, optional)
- reference_version (string, optional)
- required_own_funds (integer, optional)
- surplus_shortfall (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_mica_own_funds` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
