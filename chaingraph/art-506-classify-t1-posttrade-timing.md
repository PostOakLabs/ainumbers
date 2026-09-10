# T+1 Post-Trade Timing Classifier

Classifies the post-trade timings a caller supplies to answer the question a settlement readiness programme is actually trying to answer: which step breaches its cut-off under the shorter settlement cycle that did not breach under the longer one. Each step in the caller's declared chain order is measured against a target-cycle cut-off and a baseline-cycle cut-off, and reports its status as on time, at risk, breached or undetermined, the residual margin in seconds on both sides, and whether the shorter cycle is what breaks it. The first failing step is named, and it is the first in the declared chain order rather than the earliest by clock, because a post-trade chain is a sequence of dependencies and not a sorted list of instants. The at-risk band is a caller policy input: with no band declared there is no at-risk zone, and that absence is reported rather than filled with an invented threshold. No cut-off table is shipped and there is no named-venue profile set. Market and venue cut-offs are caller inputs, never data kept current here, because a table of cut-offs is a standing maintenance duty and a duty that silently goes false is worse than no table at all. This classifies supplied timings. It observes no venue, no central securities depository and no matching platform, it opens no connection, and it is not monitoring. No clock is read: timestamps are parsed from caller strings with a strict ISO 8601 grammar and nothing is compared against the present moment, so nothing expires on its own. Every emitted number passes a finite gate, so a missing, blank, malformed or non-existent timestamp yields a null margin with a named reason and marks the step undetermined rather than reading as on time, and an unclassified step is never counted as an on-time step. Zero personal data by construction: trades and steps are identified by opaque caller references only. Stated boundary: this computes no settlement penalty, which is a separate concern, it states nothing about funding or foreign exchange implications, it makes no claim about markets outside the cycle change the caller declares, and it is not legal, tax or regulatory advice.

- Page: https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.html
- Markdown twin: https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.md
- MCP tool: classify_t1_posttrade_timing (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- at_risk_margin_seconds (unknown, required)
- baseline_cycle (string, required)
- steps (array, required)
- target_cycle (string, required)
- time_zone_offset_minutes (unknown, required)
- trade_ref (unknown, required)
- trade_timestamp (unknown, required)
- venue_cutoff (unknown, required)

## Outputs

- at_risk_count (integer, optional)
- at_risk_margin_seconds (integer, optional)
- baseline_cycle (string, optional)
- baseline_not_compared_count (integer, optional)
- breached_count (integer, optional)
- cycle_compared (string, optional)
- first_failing_step (string, optional)
- first_newly_breaching_step (string, optional)
- newly_breaching_count (integer, optional)
- note (string, optional)
- on_time_count (integer, optional)
- rationale (array, optional)
- step_count (integer, optional)
- steps (array, optional)
- target_cycle (string, optional)
- time_zone_offset_minutes (integer, optional)
- trade_ref (string, optional)
- trade_timestamp (string, optional)
- undetermined_count (integer, optional)
- venue_cutoff (string, optional)
- verdict (string, optional)
- verdict_reason (string, optional)

## Sample

```json
{
  "trade_ref": "TRD-OPAQUE-2027-0001",
  "target_cycle": "T+1",
  "baseline_cycle": "T+2",
  "time_zone_offset_minutes": 0,
  "at_risk_margin_seconds": 0,
  "trade_timestamp": "2027-10-12T15:40:00Z",
  "venue_cutoff": "2027-10-12T16:30:00Z",
  "steps": [
    {
      "step": "allocation_sent",
      "achieved_at": "2027-10-12T21:15:00Z",
      "cutoff_target": "2027-10-12T20:00:00Z",
      "cutoff_baseline": "2027-10-13T06:00:00Z"
    },
    {
      "step": "confirmation_affirmation",
      "achieved_at": "2027-10-12T22:40:00Z",
      "cutoff_target": "2027-10-12T21:00:00Z",
      "cutoff_baseline": "2027-10-13T11:00:00Z"
    },
    {
      "step": "settlement_instruction_release",
      "achieved_at": "2027-10-13T05:30:00Z",
      "cutoff_target": "2027-10-13T06:00:00Z",
      "cutoff_baseline": "2027-10-13T18:00:00Z"
    },
    {
      "step": "csd_matching",
      "achieved_at": "2027-10-13T07:00:00Z",
      "cutoff_target": "2027-10-13T14:00:00Z",
      "cutoff_baseline": "2027-10-14T14:00:00Z"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_t1_posttrade_timing` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
