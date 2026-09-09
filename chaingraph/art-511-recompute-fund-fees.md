# Recompute Fund Fees

Recomputes a fund's management fee and performance fee from the terms the investor already holds (the fee statement and the fund agreement) and diffs the result against what was actually charged, where supplied. Management fee accrues on a declared fee base with a declared day-count convention. Performance fee applies a declared hurdle: a HARD hurdle charges only the excess return above the hurdle, a SOFT hurdle charges the full return once the hurdle is cleared, and conflating the two is the single most common performance-fee error, so hurdle_type carries no default and its absence raises judgment_required naming the field rather than guessing. The high-water mark then gates the fee to the excess above the prior peak, and a loss carry-forward is NOT cleared by a fee period ending unless the caller explicitly declares otherwise. Crystallised (payable now) and accrued-but-uncrystallised performance fee are reported as SEPARATE figures, never summed. HARD FENCE: fee rate, hurdle rate and type, high-water mark, crystallisation policy, accrual basis and day count are every one of them a caller input transcribed from the fund agreement: this kernel ships no rate table, no fund library, no term database, zero fund-administrator or market-data lookups (zero-egress). agreement_ref and terms_version are pinned in the artifact and shown on screen, so a later side letter makes an old receipt dated, not wrong. Absent charged_amounts the run is reported recompute-only, its own state, never folded into a match. A diff against charged_amounts is a finding that the recomputation disagrees on the supplied terms, never an allegation that the manager overcharged. Distinct from art-373-recompute-fund-nav, which recomputes NAV per share and is consumed rather than reimplemented here, and from art-375-compute-fund-expense-ratios, whose expense ratio cannot detect a misapplied high-water-mark reset; this node reuses art-375's fixed-point money math pattern without editing either node's kernel. Out of scope: equalisation and series accounting, carried-interest waterfalls for closed-end funds, tax treatment, and any submittability or coverage-ratio claim.

- Page: https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.html
- Markdown twin: https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.md
- MCP tool: recompute_fund_fees (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agreement_ref (unknown, optional)
- as_of (unknown, optional)
- charged_amounts (unknown, optional)
- fund_id (unknown, optional)
- management_fee (unknown, required)
- nav (unknown, required)
- performance_fee (unknown, required)
- period_days (number, required): Duration in days
- period_end (unknown, optional)
- period_start (unknown, optional)
- rounding (unknown, required)
- terms_version (unknown, optional)

## Outputs

- agreement_ref (string, optional)
- as_of (string, optional)
- diff (array, optional)
- fence (string, optional)
- fund_id (string, optional)
- judgment_required (string, optional)
- management_fee_computed (string, optional)
- not_proven (array, optional)
- performance_fee (object, optional)
- period_days (integer, optional)
- period_end (string, optional)
- period_start (string, optional)
- rationale (array, optional)
- recompute_only (boolean, optional)
- rounding (object, optional)
- terms_version (string, optional)

## Sample

```json
{
  "fund_id": "FUND-FEE-01",
  "agreement_ref": "LPA-2024-08",
  "terms_version": "1.0",
  "as_of": "2026-12-31",
  "period_start": "2026-01-01",
  "period_end": "2026-12-31",
  "period_days": 365,
  "nav": {
    "opening": "100000000",
    "closing": "112000000",
    "fee_base": "106000000"
  },
  "management_fee": {
    "rate": "0.02",
    "day_count": "actual/365"
  },
  "performance_fee": {
    "rate": "0.20",
    "hurdle_rate": "0.05",
    "hurdle_type": "hard",
    "high_water_mark": "100000000",
    "crystallisation": "period"
  },
  "rounding": {
    "decimal_places": 2,
    "mode": "half_up"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_fund_fees` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
