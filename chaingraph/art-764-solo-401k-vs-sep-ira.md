# Solo 401(k) vs. SEP-IRA Optimizer

Self-employed retirement-contribution comparator ported from ApexLogics Apex #112 (AL-119). For one self-employment profile — a four-digit tax year (an explicit as_of input, never a clock; 2026 only, other years refused), net self-employment profit in integer cents, age, a marginal rate in basis points, an outside employer-plan flag and any elective deferrals already made to that plan — the node computes, under one dated set of pinned 2026 IRS limits, the maximum Solo 401(k) (employee deferral + age-50+ catch-up + ~20%-of-net-earnings employer amount against the 415(c) ceiling), SEP-IRA (25% of net earnings after the half-SE-tax deduction) and SIMPLE IRA (employee salary reduction with the 60-63 super catch-up band + employer match ceiling) contributions, each plan's binding cap, a winner ranked by maximum contribution with a declared tie order, and the estimated tax saving at the caller-supplied marginal rate. Social Security wage-base proration feeds the SE-tax arithmetic (92.35% factor, half-SE-tax deduction) exactly as the official worksheets do. Money is integer minor units with floor division: no Date, no floats, no network. Invalid-domain inputs are rejected by throw with a named reason (`ART738_INPUT_REFUSED`); a zero net profit is refused where Apex silently defaulted it to $120,000 (payload DIFFERS.md D2), a zero marginal rate is honoured where Apex coerced it to 24% (D5), and the outside-plan input is echoed and flagged `ART738_EXISTING_PLAN_NOT_MODELED` rather than silently ignored (D4). The SIMPLE IRA age-50+ catch-up carries the official 2026 figure of $4,000 (IRS Notice 2025-67), not Apex's $5,000 — a pinned $1,000 ceiling difference recorded per-vector in the fixtures (D1); no winner changes on any payload vector. Apex's IEEE-754 doubles become floor-divided integer cents (D3), keeping sub-cent residue out of every reported field.

- Page: https://ainumbers.co/chaingraph/art-764-solo-401k-vs-sep-ira.html
- Markdown twin: https://ainumbers.co/chaingraph/art-764-solo-401k-vs-sep-ira.md
- MCP tool: compare_solo401k_sep_simple (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- tax_year (integer, required): Four-digit tax year selecting the pinned IRS limit table (2026 only). An input, never a clock; other years are refused.
- net_income_usd_cents (integer, required): Net self-employment profit in integer cents, 1..20000000000. Zero is refused (Apex silently defaulted 0 to 120000; DIFFERS D2).
- age (integer, required): Age at end of tax year, 18..120. Decides the 414(v) and SECURE 2.0 catch-up bands; band edges pinned by boundary fixtures.
- marginal_rate_bp (integer, required): Marginal rate in basis points of one, 0..10000 (2400 = 24%). Zero is honoured; Apex coerced 0 to 24% (DIFFERS D5).
- existing_employer_plan (boolean, required): Boolean. Echoed and flagged, never used in the arithmetic (Apex read it and ignored it; DIFFERS D4).
- existing_deferrals_cents (integer, required): Elective deferrals already made to an outside employer plan this year, 0..72000000; reduces 402(g) deferral room.

## Outputs

- tax_year (integer, optional)
- net_income_usd_cents (integer, optional)
- self_employment_tax_base_usd_cents (integer, optional)
- self_employment_tax_usd_cents (integer, optional)
- half_se_tax_deduction_usd_cents (integer, optional)
- net_earnings_after_half_deduction_usd_cents (integer, optional)
- age (integer, optional)
- marginal_rate_bp (integer, optional)
- catchup_eligible (boolean, optional)
- super_catchup_band (boolean, optional)
- existing_employer_plan (boolean, optional)
- existing_deferrals_cents (integer, optional)
- solo_401k (object, optional)
- sep_ira (object, optional)
- simple_ira (object, optional)
- winner (string, optional)
- winner_tied (boolean, optional)
- winner_tie_order (array, optional)
- refusal_reason (string, optional)
- domain_errors (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "tax_year": 2026,
  "net_income_usd_cents": 12000000,
  "age": 45,
  "marginal_rate_bp": 2400,
  "existing_employer_plan": false,
  "existing_deferrals_cents": 0
}
```

## Verify

Run the sample through MCP tool `compare_solo401k_sep_simple` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
