# FX Funding Sequencer

Orders a trade's declared currency legs by FX cutoff and computes margin-to-cutoff minutes from the declared confirm time, for one declared T+1 settle date, returning an all-cutoffs-met verdict: sequence (tightest margin first, ties in declared order), margins_minutes (cutoff minus confirm, integer minutes, negative where a declared cutoff is at or before the declared confirm), all_cutoffs_met, a trace line, and an overall of FUNDING_SEQUENCED, CUTOFF_MISSED, or INDETERMINATE. Times are declared UTC HH:MM strings and the math is pure comparison on the one declared settle date - no timezone conversion, date rollover, holiday calendar, or daylight-saving adjustment. Any absent or malformed declared input (settle date, confirm time, or a leg's currency code or cutoff time), or a duplicate declared currency leg, fails closed to INDETERMINATE with each offending input named - never a partial sequence. This tool computes arithmetic of declared inputs under named rules; it does not check live SSR tapes, borrow lists, cutoff feeds, or registers, and the PvP check is out of scope: the PvP validator surface is pointed at as a link, never a duplicated verdict (see art-58-cross-network-settlement-validator).

- Page: https://ainumbers.co/chaingraph/art-672-fx-funding-sequencer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-672-fx-funding-sequencer.md
- MCP tool: compute_fx_funding_sequencer (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "settle_date": "2026-10-13",
  "trade_confirm_utc": "14:20",
  "legs": [
    {
      "ccy": "EUR",
      "cutoff_utc": "15:00"
    },
    {
      "ccy": "USD",
      "cutoff_utc": "21:00"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fx_funding_sequencer` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
