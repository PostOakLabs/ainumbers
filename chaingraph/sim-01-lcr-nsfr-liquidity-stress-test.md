# Liquidity Stress Test Simulator (LCR/NSFR)

Monte Carlo simulation of LCR and NSFR under Basel III stress (CRR Art. 412/428, EBA GL/2017/01). 1,000 paths × 250 time steps. P5–P95 percentile distribution, breach probability, time-to-breach, sensitivity tornado.

- Page: https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html
- Markdown twin: https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.md
- MCP tool: run_liquidity_stress_test (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asf_cap (any, required): type not evidenced by kernel source
- hqla_l1 (any, required): type not evidenced by kernel source
- hqla_l2a (any, required): type not evidenced by kernel source
- hqla_l2b (any, required): type not evidenced by kernel source
- inflows (any, required): type not evidenced by kernel source
- n_paths (number, optional)
- preset (any, required): type not evidenced by kernel source
- retail_outflow (any, required): type not evidenced by kernel source
- rsf_loans (any, required): type not evidenced by kernel source
- rsf_other (any, required): type not evidenced by kernel source
- rsf_securities (any, required): type not evidenced by kernel source
- scenario (any, required): type not evidenced by kernel source
- secured_outflow (any, required): type not evidenced by kernel source
- seed (any, optional): type not evidenced by kernel source
- wholesale_outflow (any, required): type not evidenced by kernel source

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
