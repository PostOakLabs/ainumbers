# HDHP vs. PPO Break-Even

Annual-cost comparator for an HDHP+HSA against a PPO, ported from ApexLogics #105 (AL-112). For two plan profiles (monthly premium, deductible, out-of-pocket maximum, coinsurance percent), an HSA profile (employer and additional personal contribution), a marginal tax rate, a coverage class and an expected annual medical spend, the node finds the break-even medical spend, the first $50 grid point in [0, 20000] at which the HDHP annual total (premium + plan OOP minus the HSA tax shield) is less than or equal to the PPO annual total, and reports the two totals at the expected spend, the strict winner and savings, a fixed seven-step comparison table (plus the expected spend), the capped HSA contribution and its tax shield, and a three-way recommendation (PPO_ALL_LEVELS / PPO_LIKELY / HDHP_BETTER). The 2026 HSA contribution limits ($4,400 self-only / $8,750 family, IRS Rev. Proc. 2025-19 §2.01(1)) are the only constants in the compute; the age-55+ catch-up is stated in the source page's hint text but not applied by its engine, and the port preserves that exactly. The node reads no clock (explicit as_of input echoes the Apex page's wall-clock export timestamp). Invalid-domain inputs are refused with a named reason. Plan-cost model only: no FSA/HRA interactions, no out-of-network or balance-billing, no premium tax credits, no state-specific HSA deduction rules, no investment growth on HSA balances; totals are the source page's own unrounded dollar arithmetic.

- Page: https://ainumbers.co/chaingraph/art-758-hdhp-ppo-break-even.html
- Markdown twin: https://ainumbers.co/chaingraph/art-758-hdhp-ppo-break-even.md
- MCP tool: estimate_hdhp_ppo_breakeven (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Run date, YYYY-MM-DD. Never read from a clock; echoed for determinism.
- coverage (string, required): HSA coverage class.
- hdhp_premium_monthly (number, required)
- hdhp_deductible (number, required)
- hdhp_oop_max (number, required)
- hdhp_coinsurance_pct (number, required)
- ppo_premium_monthly (number, required)
- ppo_deductible (number, required)
- ppo_oop_max (number, required)
- ppo_coinsurance_pct (number, required)
- employer_hsa (number, required)
- additional_hsa (number, required)
- marginal_tax_rate_pct (number, required)
- expected_annual_spend (number, required)

## Outputs

- as_of (null,string, optional)
- coverage (null,string, optional)
- break_even_spend (number,null, optional)
- hdhp_total_at_expected (null,number, optional)
- ppo_total_at_expected (null,number, optional)
- winner (null,string, optional)
- savings (null,number, optional)
- hsa_total_applied (null,number, optional)
- hsa_tax_shield (null,number, optional)
- comparison_table (array, optional)
- recommendation (null,string, optional)
- refusals (array, optional)
- refusal_reason (string,null, optional)
- domain_errors (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "as_of": "2026-10-13",
  "coverage": "individual",
  "hdhp_premium_monthly": 180,
  "hdhp_deductible": 2800,
  "hdhp_oop_max": 7000,
  "hdhp_coinsurance_pct": 20,
  "ppo_premium_monthly": 380,
  "ppo_deductible": 500,
  "ppo_oop_max": 5000,
  "ppo_coinsurance_pct": 20,
  "employer_hsa": 500,
  "additional_hsa": 1500,
  "marginal_tax_rate_pct": 22,
  "expected_annual_spend": 2000
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_hdhp_ppo_breakeven` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
