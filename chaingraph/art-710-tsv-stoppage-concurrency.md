# TSV Stoppage Concurrency

Checks a tokenized-stock venue (TSV) against condition H of the SEC TSV Exemption (FR 2026-19388, 91 Fed. Reg. 60176, Sept. 22, 2026): a TSV must stop trading in a Tokenized NMS Stock concurrently with any stoppage of trading in the underlying NMS stock on the primary listing exchange, which includes a halt or a suspension, and must immediately notify its TSV Participants. Replays caller-supplied TSV trades against caller-declared listing-exchange stoppage intervals under a declared half-open boundary rule (start-inclusive, end-exclusive), flags every trade inside an interval beyond the caller-declared concurrency tolerance, checks that the TSV's own halt record spans each stoppage (an open-ended stoppage is covered only by an open-ended record), and reports participant-notice presence with the notice latency as a MEASURED value in milliseconds from stoppage start to the earliest notice at or after it, never graded pass/fail because the order says "immediately" without a number. Per stoppage: covered, trades_during, trades_flagged, trades_within_tolerance, notice_latency_ms; violations carry TRADE_DURING_STOPPAGE, HALT_RECORD_NOT_COVERING and NO_PARTICIPANT_NOTICE. Evidence only: it states no opinion on whether any latency, gap or trade is lawful. Zero network: the node never reads a chain and checks only what the caller supplies.

- Page: https://ainumbers.co/chaingraph/art-710-tsv-stoppage-concurrency.html
- Markdown twin: https://ainumbers.co/chaingraph/art-710-tsv-stoppage-concurrency.md
- MCP tool: check_tsv_stoppage_concurrency (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- stoppages (array, required): Caller-declared stoppages of the underlying NMS stock on the listing exchange; each { symbol, start_ts, end_ts|null, kind: halt | suspension | mwcb }.
- tsv_trades (array, required): The TSV's tokenized-stock trades; each { symbol, ts, trade_id }.
- tsv_halt_records (array, required): The TSV's own halt records; each { symbol, start_ts, end_ts|null }. Each stoppage must be spanned by one of them.
- participant_notices (array, required): Participant notices; each { symbol, ts }. Latency is measured from stoppage start to the earliest notice at or after it.
- concurrency_tolerance_ms (integer, optional): Optional non-negative integer (default 0), echoed. Widens the tolerated window around the interval edges.

## Outputs

- assumptions (array, required)
- concurrency_tolerance_ms (number,null, required)
- counts (object,null, optional)
- detail (string, optional)
- domain_errors (array, optional)
- error (string, optional)
- per_stoppage (array, required)
- violations (array, required)

## Sample

```json
{
  "stoppages": [
    {
      "symbol": "AAPL",
      "start_ts": 1000,
      "end_ts": 2000,
      "kind": "halt"
    }
  ],
  "tsv_trades": [
    {
      "symbol": "AAPL",
      "ts": 1001,
      "trade_id": "T-1"
    }
  ],
  "tsv_halt_records": [
    {
      "symbol": "AAPL",
      "start_ts": 1000,
      "end_ts": 2000
    }
  ],
  "participant_notices": [
    {
      "symbol": "AAPL",
      "ts": 1000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_tsv_stoppage_concurrency` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
