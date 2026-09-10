# Canton Synchronizer Traffic-Cost Calculator

Computes Canton Network synchronizer traffic cost (CIP-0042/CIP-0084 regime): fee = message megabytes x the Tokenomics-Committee-set USD/MB rate, converted to Canton Coin burned at a caller-supplied CC/USD price. Applies the CIP-0119 transfer-preapproval free-traffic window (90-day base duration since June 2026) when the traffic is a preapproval within its free period. Rate, price, and protocol-version inputs are caller-supplied and source-cited in the output - this kernel never hard-codes a fee or price as a silent constant. Distinct from the shipped tokenization-readiness/DvP/allowlist Canton nodes (503/507/509), which validate settlement and counterparty structure rather than compute synchronizer traffic economics.

- Page: https://ainumbers.co/chaingraph/art-391-compute-canton-traffic-cost.html
- Markdown twin: https://ainumbers.co/chaingraph/art-391-compute-canton-traffic-cost.md
- MCP tool: compute_canton_traffic_cost (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cc_usd_price (number, optional)
- envelope_mb (number, optional)
- is_transfer_preapproval (boolean, required)
- preapproval_age_days (number, optional): Duration in days
- protocol_version (unknown, required)
- rate_usd_per_mb (number, optional)

## Outputs

- cc_burned (integer, optional)
- cc_usd_price (number, optional)
- disambiguation (string, optional)
- effective_rate_usd_per_mb (integer, optional)
- envelope_mb (number, optional)
- free_period_applies (boolean, optional)
- free_period_days (integer, optional)
- free_period_source (string, optional)
- is_transfer_preapproval (boolean, optional)
- preapproval_age_days (integer, optional)
- protocol_version (string, optional)
- rate_source (string, optional)
- rate_usd_per_mb (integer, optional)
- usd_traffic_cost (integer, optional)

## Sample

```json
{
  "protocol_version": "3.5.5",
  "envelope_mb": 2.5,
  "rate_usd_per_mb": 60,
  "cc_usd_price": 12.5,
  "is_transfer_preapproval": false,
  "preapproval_age_days": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_canton_traffic_cost` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
