# G20/FSB Corridor Cost-Gap Calculator

Recomputes a caller-declared cross-border payment corridor's cost gap against the hardcoded G20/FSB roadmap targets: retail cross-border payments end-2027 (no more than 1% global average, no more than 3% any corridor) and remittances 2030 (no more than 3% global average, no more than 5% any corridor). The caller supplies the corridor's observed total-cost percentage (as integer basis points), sourced from World Bank Remittance Prices Worldwide (RPW, methodology Q325) or elsewhere; this kernel never vendors RPW's own corridor cost table, only the published target arithmetic. Zero live FX/rate calls. These are transparency and benchmarking targets, not an enforceable deadline against any single firm - not a compliance-gate. Not the US Reg E remittance disclosure recompute (see art-reg-e-remittance-disclosure-check for that).

- Page: https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.html
- Markdown twin: https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.md
- MCP tool: check_g20_corridor_cost_gap (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- corridor_pair (boolean, required)
- observed_cost_bps (unknown, required): Amount in basis points
- send_amount_basis (string, required)
- target_year (unknown, required)

## Outputs

- as_of (string, optional)
- corridor_pair (object, optional)
- gap_bps (integer, optional)
- gap_pct_display (string, optional)
- meets_target (boolean, optional)
- note (string, optional)
- observed_cost_bps (integer, optional)
- observed_cost_display (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- rpw_methodology (object, optional)
- send_amount_basis (string, optional)
- target_any_corridor_bps (integer, optional)
- target_any_corridor_display (string, optional)
- target_basis (string, optional)
- target_global_avg_bps (integer, optional)
- target_global_avg_display (string, optional)
- target_scope (string, optional)
- target_year (integer, optional)

## Sample

```json
{
  "as_of": "2026-08-01",
  "corridor_pair": {
    "send_country": "US",
    "receive_country": "MX"
  },
  "observed_cost_bps": 250,
  "send_amount_basis": "USD_200",
  "target_year": 2027
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_g20_corridor_cost_gap` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
