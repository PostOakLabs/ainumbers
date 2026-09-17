# BCBS 248 Intraday Liquidity Monitoring Snapshot

BCBS 248 "Monitoring tools for intraday liquidity management" (Basel Committee, April 2013): computes daily maximum intraday liquidity usage (the largest negative excursion of a cumulative net settlement position built from a caller-supplied time-stamped transaction list), echoes start-of-day available liquidity, totals gross payments and receipts, checks time-specific obligations against their due times, and classifies the daily maximum usage against a caller-supplied list of available intraday liquidity sources. Not DW capacity (art-427) or FR 2052a inflow/outflow classification (art-437) - adjacent but distinct BCBS 248 daily-usage metrics. Evidence artifact only, not a filing or supervisory submission.

- Page: https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.html
- Markdown twin: https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.md
- MCP tool: compute_intraday_liquidity_monitoring (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- available_intraday_sources (unknown, required)
- start_of_day_available_musd (number, optional)
- time_specific_obligations (unknown, required)
- transactions (unknown, required)

## Outputs

- available_intraday_sources (array, optional)
- available_sources_total_musd (integer, optional)
- coverage_ratio (number, optional)
- cumulative_position_path (array, optional)
- daily_max_usage_musd (integer, optional)
- note (string, optional)
- obligations_summary (object, optional)
- regulatory_basis (string, optional)
- start_of_day_available_musd (integer, optional)
- time_specific_obligations (array, optional)
- total_payments_musd (integer, optional)
- total_receipts_musd (integer, optional)
- usage_covered (boolean, optional)

## Sample

```json
{
  "start_of_day_available_musd": 500,
  "transactions": [
    {
      "tx_id": "t1",
      "time_hhmm": "08:00",
      "flow_type": "inflow",
      "amount_musd": 100
    },
    {
      "tx_id": "t2",
      "time_hhmm": "09:30",
      "flow_type": "outflow",
      "amount_musd": 250
    },
    {
      "tx_id": "t3",
      "time_hhmm": "10:15",
      "flow_type": "outflow",
      "amount_musd": 120
    },
    {
      "tx_id": "t4",
      "time_hhmm": "13:00",
      "flow_type": "inflow",
      "amount_musd": 200
    },
    {
      "tx_id": "t5",
      "time_hhmm": "15:45",
      "flow_type": "outflow",
      "amount_musd": 80
    }
  ],
  "time_specific_obligations": [
    {
      "obligation_id": "o1",
      "due_time_hhmm": "10:00",
      "settled_time_hhmm": "09:45",
      "amount_musd": 150
    },
    {
      "obligation_id": "o2",
      "due_time_hhmm": "14:00",
      "settled_time_hhmm": "13:30",
      "amount_musd": 90
    }
  ],
  "available_intraday_sources": [
    {
      "source_id": "src-cb-balance",
      "amount_musd": 200
    },
    {
      "source_id": "src-committed-line",
      "amount_musd": 150
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_intraday_liquidity_monitoring` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
