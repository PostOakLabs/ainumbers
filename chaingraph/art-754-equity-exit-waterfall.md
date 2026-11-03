# Equity Exit Waterfall Modeler

Equity exit proceeds after a liquidation-preference waterfall, ported from ApexLogics Apex #141 (AL-148). From the exit valuation, the aggregate preferred investment, the preferred ownership fraction and liquidation-preference multiple, the participation type (non/full/capped with a cap multiple), and your role, ownership, option strike and cost basis, the node walks the waterfall layer by layer: the preference is min(exit, invested × multiple); non-participating preferred converts to common only when its pro-rata share strictly exceeds the preference (NVCA convention, strict inequality); full participating takes the preference then shares pro-rata; capped participating takes the preference plus pro-rata participation floored at 0 and capped at cap × invested, with the excess reverting to the common pool. Your gross proceeds follow your role (preferred shares in the preferred total; common takes the declared fraction of the common pool), net proceeds are floored at 0 after the option strike, taxable gain is max(0, net − basis) per IRC §1001, and the break-even exit (0 for the preferred role, per Apex) is preference + strike / (common share of common). Non-finite inputs are refused with REFUSED_NON_FINITE_INPUT per the I-JSON guard and a non-positive exit with REFUSED_NON_POSITIVE_EXIT, never a silent guess. The preferred-captured-more-than-common warning is Apex #141's own heuristic, carried flagged (ART754_PREF_WINS_WARNING_HEURISTIC); no official threshold exists for it.

- Page: https://ainumbers.co/chaingraph/art-754-equity-exit-waterfall.html
- Markdown twin: https://ainumbers.co/chaingraph/art-754-equity-exit-waterfall.md
- MCP tool: calc_equity_exit_waterfall (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exit_valuation_usd (number, required): Total exit valuation in USD. Must be positive.
- total_preferred_invested_usd (number, required): Aggregate liquidation preference amount (total preferred invested) in USD.
- preferred_ownership_pct (number, required): Preferred ownership percentage (fully-diluted), 0-100.
- liquidation_preference_multiple (number, required): Liquidation preference multiple (e.g., 1, 1.5, 2, 3).
- participation_type (string, required): Participation type: 'non', 'full', or 'capped'.
- participation_cap_multiple (number, required): Participation cap as multiple of invested (e.g., 3 means 3x invested).
- your_role (string, required): Your role: 'common', 'founder', 'employee', or 'preferred'.
- your_ownership_pct (number, required): Your ownership percentage (fully-diluted), 0-100.
- your_option_strike_total_usd (number, required): Total option exercise cost in USD. Enter 0 for RSAs or vested stock.
- your_cost_basis_usd (number, required): Your cost basis for tax gain calculation in USD.

## Outputs

- break_even_exit_usd (number,null, required)
- common_pool_usd (number,null, required)
- compliance_flags (array, required)
- exit_valuation_usd (number, required)
- layers (array,null, required)
- liquidation_preference_multiple (number, required)
- liquidation_preference_usd (number,null, required)
- notes (array, required)
- participation_cap_multiple (number, required)
- participation_type (string, required)
- preferred_ownership_fraction (number, required)
- preferred_total_usd (number,null, required)
- refusal_reason (null,string, required)
- switches (object, required)
- total_preferred_invested_usd (number, required)
- warnings (array, required)
- your_cost_basis_usd (number, required)
- your_gross_proceeds_usd (number,null, required)
- your_net_proceeds_usd (number,null, required)
- your_option_strike_total_usd (number, required)
- your_ownership_fraction (number, required)
- your_role (string, required)
- your_taxable_gain_usd (number,null, required)

## Sample

```json
{
  "exit_valuation_usd": 50000000,
  "total_preferred_invested_usd": 10000000,
  "preferred_ownership_pct": 60,
  "liquidation_preference_multiple": 1,
  "participation_type": "non",
  "participation_cap_multiple": 3,
  "your_role": "common",
  "your_ownership_pct": 5,
  "your_option_strike_total_usd": 50000,
  "your_cost_basis_usd": 50000
}
```

## Verify

Run the sample policy_parameters through MCP tool `calc_equity_exit_waterfall` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
