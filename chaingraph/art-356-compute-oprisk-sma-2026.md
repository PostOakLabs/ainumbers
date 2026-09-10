# Basel Operational Risk SMA (2026 Reproposal)

Basel Standardized Measurement Approach (SMA) for operational-risk capital per the July 2026 US Basel Endgame reproposal (comment period closed 2026-06-18, final expected ~Q4 2026): marginal Business Indicator Component across the $1bn/$30bn buckets (12%/15%/18%) and the Internal Loss Multiplier, applying the reproposal's US-variant ILM neutralization to 1 by default with a switch to model the non-neutralized BCBS d424 formula. rule_status: proposed - re-pin at finalization. Formula-focused; does not model scenario/portfolio replay (see the SIM-REPLAY suite for that).

- Page: https://ainumbers.co/chaingraph/art-356-compute-oprisk-sma-2026.html
- Markdown twin: https://ainumbers.co/chaingraph/art-356-compute-oprisk-sma-2026.md
- MCP tool: compute_oprisk_sma_2026 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_op_losses (array, required)
- fc_avg (number, optional)
- ildc_avg (number, optional)
- sc_avg (number, optional)
- use_us_ilm_neutralization (boolean, required)

## Outputs

- average_annual_loss (integer, optional)
- bucket (integer, optional)
- business_indicator (integer, optional)
- business_indicator_component (integer, optional)
- constants_version (string, optional)
- fc_avg (integer, optional)
- ildc_avg (integer, optional)
- internal_loss_multiplier (integer, optional)
- loss_component (integer, optional)
- note (string, optional)
- operational_risk_capital (integer, optional)
- regulatory_basis (string, optional)
- rule_status (string, optional)
- rwa (integer, optional)
- sc_avg (integer, optional)
- use_us_ilm_neutralization (boolean, optional)

## Sample

```json
{
  "ildc_avg": 300000000,
  "sc_avg": 150000000,
  "fc_avg": 50000000,
  "use_us_ilm_neutralization": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_oprisk_sma_2026` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
