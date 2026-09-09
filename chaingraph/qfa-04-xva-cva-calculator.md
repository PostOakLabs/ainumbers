# XVA / CVA Calculator

Monte Carlo XVA/CVA calculator. Simulates expected-exposure profiles for IRS, FX forwards, and CDS; computes CVA, DVA, FVA via discounted expected positive/negative exposure. Zero-egress.

- Page: https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.md
- MCP tool: calculate_xva (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cpyLGD_pct (number, required): Percentage value
- cpyPD_pct (number, required): Percentage value
- funding_bps (number, required): Amount in basis points
- instrument (unknown, required)
- maturity_years (unknown, required)
- n_paths (number, required)
- n_steps (number, required)
- notional (unknown, required)
- ownPD_pct (number, required): Percentage value
- preset (unknown, required)
- rfr_pct (number, required): Percentage value
- seed (unknown, optional)
- vol_pct (number, required): Percentage value

## Outputs

- compliance_flags (array, optional)
- cva (number, optional)
- cva_basis (string, optional)
- dva (number, optional)
- dva_basis (string, optional)
- fva (number, optional)
- fva_basis (string, optional)
- n_paths (integer, optional)
- n_steps (integer, optional)
- peak_epe (number, optional)
- peak_epe_pct_notional (number, optional)
- verdict (string, optional)
- xva (number, optional)
- xva_risk_rating (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_xva` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
