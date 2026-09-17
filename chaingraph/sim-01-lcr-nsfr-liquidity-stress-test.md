# Liquidity Stress Test Simulator (LCR/NSFR)

Monte Carlo simulation of LCR and NSFR under Basel III stress (CRR Art. 412/428, EBA GL/2017/01). 1,000 paths × 250 time steps. P5–P95 percentile distribution, breach probability, time-to-breach, sensitivity tornado.

- Page: https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html
- Markdown twin: https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.md
- MCP tool: run_liquidity_stress_test (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asf_cap (unknown, required)
- hqla_l1 (unknown, required)
- hqla_l2a (unknown, required)
- hqla_l2b (unknown, required)
- inflows (unknown, required)
- n_paths (number, optional)
- preset (unknown, required)
- retail_outflow (unknown, required)
- rsf_loans (unknown, required)
- rsf_other (unknown, required)
- rsf_securities (unknown, required)
- scenario (unknown, required)
- secured_outflow (unknown, required)
- seed (unknown, optional)
- wholesale_outflow (unknown, required)

## Outputs

- compliance_flags (array, optional)
- lcr_breach_pct (integer, optional)
- lcr_median_day30 (number, optional)
- lcr_p5 (number, optional)
- n_paths (integer, optional)
- nsfr_breach_pct (integer, optional)
- nsfr_median_day250 (number, optional)
- nsfr_p5 (number, optional)
- scenario (string, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_liquidity_stress_test` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
