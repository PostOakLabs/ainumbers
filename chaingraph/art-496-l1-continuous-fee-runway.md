# L1 Continuous-Fee Runway Model

Avalanche Evergreen L1 continuous-fee TCO and depletion-runway model. ACP-77 replaced the 2000 AVAX stake requirement with a continuous, dynamic P-Chain fee drawn from an L1 balance that depletes and needs refills, so the fee rate and its growth assumption are always caller inputs, never baked in. Computes validator count times fee rate, plus infra cost, plus current balance into an annual TCO and its per-component breakdown. The novel output is months_to_depletion and depletion_offset_days: the point at which the L1 runs out of balance and stops validating, an offset from the caller-supplied as_of, never a clock read. Also returns the refill amount required to reach a caller-supplied target runway. Zero balance, zero validators or a zero fee rate each resolve to a defined, finite result rather than an unbounded projection. No chain observation, no RPC: every input is caller-transcribed state. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.html
- Markdown twin: https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.md
- MCP tool: model_l1_fee_runway (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- current_balance (unknown, required)
- fee_growth_rate_annual_pct (unknown, required): Percentage value
- fee_rate_avax_per_validator_month (unknown, required)
- horizon_months (unknown, required)
- infra_cost_annual (unknown, required)
- target_runway_months (unknown, required)
- validator_count (unknown, required): Count

## Outputs

- annual_tco (integer, optional)
- as_of (integer, optional)
- breakdown (object, optional)
- current_balance (integer, optional)
- depletion_offset_days (integer, optional)
- fee_growth_rate_annual_pct (integer, optional)
- fee_rate_avax_per_validator_month (number, optional)
- fee_rate_defaulted (boolean, optional)
- horizon_months (integer, optional)
- infra_cost_annual (integer, optional)
- months_to_depletion (integer, optional)
- rationale (array, optional)
- refill_amount_required (number, optional)
- runway_flag (string, optional)
- target_runway_months (integer, optional)
- validator_count (integer, optional)

## Sample

```json
{
  "validator_count": 50,
  "fee_rate_avax_per_validator_month": 1.33,
  "fee_growth_rate_annual_pct": 10,
  "infra_cost_annual": 12000,
  "current_balance": 6000,
  "as_of": 1753900000,
  "target_runway_months": 24
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_l1_fee_runway` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
