# VaR Backtesting Traffic-Light Zone Calculator

Counts Basel VaR backtesting exceptions (actual daily P&L loss exceeding the model's 1-day VaR estimate) over a rolling up-to-250-trading-day window, then looks up the green/yellow/red traffic-light zone and capital multiplier per the Basel Committee's 1996 Amendment to the Capital Accord to Incorporate Market Risks, Part V, retained under BCBS d457 (Jan 2019) internal-models-approach backtesting. Exception-count plus zone plus multiplier lookup only - does NOT compute VaR itself and does NOT apply the multiplier to a capital charge.

- Page: https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.html
- Markdown twin: https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.md
- MCP tool: compute_var_backtest_traffic_light (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- observations (array, required)

## Outputs

- constants_version (string, optional)
- disambiguation (string, optional)
- exception_count (integer, optional)
- exception_indices (array, optional)
- full_window (boolean, optional)
- multiplier (integer, optional)
- rule_status (string, optional)
- source (string, optional)
- truncated_to_250 (boolean, optional)
- window_days (integer, optional)
- zone (string, optional)

## Sample

```json
{
  "observations": [
    {
      "date": "2026-01-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-11",
      "pnl": -150000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-25",
      "pnl": -150000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-05",
      "pnl": -150000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-26",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-27",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-28",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-01",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-02",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-03",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-04",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-05",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-06",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-07",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-08",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-09",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-10",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-11",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-12",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-13",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-14",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-11-15",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-12-16",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-01-17",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-02-18",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-03-19",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-04-20",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-05-21",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-06-22",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-07-23",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-08-24",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-09-25",
      "pnl": 20000,
      "var_estimate": 100000
    },
    {
      "date": "2026-10-26",
      "pnl": 20000,
      "var_estimate": 100000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_var_backtest_traffic_light` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
