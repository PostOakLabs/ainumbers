# Event Contract Position Limit Check

Checks a book of event-contract positions, stated as quantities and prices only, against caller-declared position accountability levels and position limits, per contract, per event or per series: computes each position maximum loss from the side (yes loses its full cost, no loses payout minus price), rounded up to the next minor unit (ceiling, conservative toward finding); nets yes and no quantities on the same contract only when the caller declares per_contract_net; applies market-maker treatment as data (accountability multiplier default 10x and limit exemption on program contracts under the pinned Kalshi rulebook profile, all values caller-overridable, no defaults on the generic profile); and reports accountability breaches and limit breaches each with the profile rule cite, verdict WITHIN, ACCOUNTABILITY_REVIEW or LIMIT_BREACH. Every limit figure is caller-supplied - the node hard-codes no venue figure - and aggregation across similar contracts is venue-specific: CFTC staff guidance on that question (staff advisory and advance notice, 2026) sets no numeric levels. The node reports arithmetic against declared levels; it never states that a participant violated a rule. Declared domain exclusions: identifier-like labels (account ids, member ids, addresses, emails, hashes) are refused and never echoed; unknown profiles, malformed dates, out-of-window as_of, out-of-enum aggregation, netting, participant class, side and limit basis are refused with structured non-verdicts; no fee or pricing arithmetic (fee and pricing nodes art-211 and art-212 cover that); no trading or legal advice.

- Page: https://ainumbers.co/chaingraph/790-event-position-limit-check.html
- Markdown twin: https://ainumbers.co/chaingraph/790-event-position-limit-check.md
- MCP tool: check_event_contract_position_limits (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "kalshi_rulebook_v1_29",
  "as_of": "2026-10-31",
  "aggregation": "per_contract",
  "netting": "gross",
  "participant_class": "standard",
  "positions": [
    {
      "contract_label": "C-1",
      "event_label": "ELEC-2026",
      "series_label": "SENATE-AZ",
      "side": "yes",
      "quantity": 500,
      "avg_price_micro": 300000,
      "max_loss_minor": null,
      "accountability_level_minor": 16000,
      "limit_minor": 20000,
      "limit_basis": "max_loss"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_event_contract_position_limits` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
