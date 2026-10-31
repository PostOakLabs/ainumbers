# Solo 401(k) vs. SEP-IRA Optimizer

Self-employed retirement-contribution comparator ported from ApexLogics Apex #112 (AL-119). For a tax year, net self-employment profit, age at end of tax year, marginal rate, outside-plan flag and existing elective deferrals, the node prices three retirement-vehicle ceilings under one dated set of IRS limits; Solo 401(k) (402(g) deferral + 414(v)/SECURE 2.0 catch-up + 25% employer profit sharing under 415(c)), SEP-IRA (25% of net earnings after the one-half SE-tax deduction, capped at 72,000) and SIMPLE IRA (408(p)(2)(E)(iii) salary reduction plus a 2% nonelective employer contribution); ranks them by maximum contribution with a declared tie order, reports each plan's binding cap, and returns the estimated tax saving at the caller-supplied marginal rate. The tax year is an explicit as_of input selecting the pinned LIMITS_BY_TAX_YEAR table (2026 only); any other year is a NO_LIMITS_FOR_TAX_YEAR refusal, never a silent fallback. Money is integer cents with floor division. Where Apex disagreed with the official 2026 figures the official figure won (DIFFERS.md D1: SIMPLE age-50+ catch-up 4,000 vs Apex's 5,000), a zero net income and a zero marginal rate are honoured instead of silently substituted (D2, D5), the dead existing_employer_plan input is echoed and flagged (D4), and the unreachable Solo total cap is kept for shape fidelity with its binding reported (D7).

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

Run the sample policy_parameters through MCP tool `compare_solo401k_sep_simple` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
