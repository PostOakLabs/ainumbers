# Exchange Access-Fee / Maker-Taker Tier Recompute

Recomputes a monthly exchange maker-taker invoice from a caller-pasted fee schedule: resolves the firm's active tier from its declared prior-period average daily volume (ADV), applies that tier's maker rebate and taker access-fee rate to the declared monthly maker/taker share totals, and diffs the recomputed amount against the claimed invoice within a declared tolerance - verdict MATCHES, DIVERGES, or INDETERMINATE when no tier qualifies. Separately, independent of which tier is currently active, checks every tier's taker rate in the declared schedule against the Reg NMS Rule 610(c) access-fee cap ($0.001/share for quotations priced at $1.00/share or more, compliance date 2026-11-02) - verdict CAP_CONFORMANT, CAP_EXCEEDS, or INDETERMINATE when the caller has not declared that the schedule applies to quotes priced at $1.00/share or more. The two checks never gate each other: a schedule can conform to the cap while its invoice diverges, or the reverse. Fee schedules, ADV, and monthly volume are caller-declared inputs; this tool does not source, fetch, or maintain any exchange's published schedule. All rates and money amounts are integer micro-dollars (1 micro = $0.000001) so the arithmetic is exact. Not legal or accounting advice; a DIVERGES or CAP_EXCEEDS verdict is a citable arithmetic finding for the firm and, where relevant, its counsel to evaluate against the exchange's actual published schedule and rule text.

- Page: https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.md
- MCP tool: recompute_exchange_fee_tier_invoice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimed_invoice_micros (unknown, required)
- fee_schedule (unknown, required)
- invoice_period (unknown, required)
- prior_period_adv_shares (unknown, required)
- recompute_tolerance_micros (unknown, required)
- volume_lines (array, required)

## Outputs

- active_tier (object, optional)
- cap_check (object, optional)
- cap_verdict (string, optional)
- claimed_invoice_micros (integer, optional)
- clause_note (string, optional)
- decision (object, optional)
- diff_micros (integer, optional)
- fee_schedule_summary (object, optional)
- findings (array, optional)
- invoice_period (object, optional)
- invoice_verdict (string, optional)
- prior_period_adv_shares (integer, optional)
- recompute_tolerance_micros (integer, optional)
- recomputed_invoice_micros (integer, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- tiers (array, optional)
- volume_summary (object, optional)

## Sample

```json
{
  "recompute_tolerance_micros": 1000,
  "invoice_period": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-30"
  },
  "prior_period_adv_shares": 6000000,
  "fee_schedule": {
    "schedule_id": "demo-exchange-tier-schedule-2026-06",
    "effective_date": "2026-01-01",
    "quotes_priced_ge_1usd": true,
    "tiers": [
      {
        "tier_id": "tier-1-base",
        "min_adv_shares": 0,
        "maker_rate_micros_per_share": -200,
        "taker_rate_micros_per_share": 300
      },
      {
        "tier_id": "tier-2-mid",
        "min_adv_shares": 1000000,
        "maker_rate_micros_per_share": -250,
        "taker_rate_micros_per_share": 300
      },
      {
        "tier_id": "tier-3-top",
        "min_adv_shares": 5000000,
        "maker_rate_micros_per_share": -300,
        "taker_rate_micros_per_share": 300
      }
    ]
  },
  "volume_lines": [
    {
      "side": "maker",
      "shares": 4000000
    },
    {
      "side": "taker",
      "shares": 2500000
    }
  ],
  "claimed_invoice_micros": -450000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_exchange_fee_tier_invoice` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
