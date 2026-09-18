# Basel RWA Scenario Modeler

SA-CR / F-IRB / A-IRB RWA in parallel with output-floor comparison (72.5% §CAP30). BCBS d424 IRB capital formula with Φ⁻¹ rational approximation, LCG Monte Carlo. Percentile table P5–P99. Three portfolio mixes.

- Page: https://ainumbers.co/chaingraph/sim-03-basel-rwa-scenario-modeler.html
- Markdown twin: https://ainumbers.co/chaingraph/sim-03-basel-rwa-scenario-modeler.md
- MCP tool: compute_rwa_scenarios (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- airb_lgd_pct (any, optional): Percentage value; type not evidenced by kernel source
- airb_pd_pct (any, optional): Percentage value; type not evidenced by kernel source
- ead_bn (any, optional): Amount in billions; type not evidenced by kernel source
- firb_lgd_pct (any, optional): Percentage value; type not evidenced by kernel source
- firb_pd_pct (any, optional): Percentage value; type not evidenced by kernel source
- mc_n (any, optional): type not evidenced by kernel source
- mc_scenarios (number, required)
- mix (any, required): type not evidenced by kernel source
- mix_preset (any, optional): type not evidenced by kernel source

## Outputs

- airb_floored_bn (number, optional)
- airb_pcts (array, optional)
- airb_rwa_bn (number, optional)
- firb_floored_bn (number, optional)
- firb_pcts (array, optional)
- firb_rwa_bn (number, optional)
- floor_binding (object, optional)
- floor_rwa_bn (number, optional)
- percentile_labels (array, optional)
- sacr_pcts (array, optional)
- sacr_rwa_bn (number, optional)
- verdict (string, optional)
- warnings (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_rwa_scenarios` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
