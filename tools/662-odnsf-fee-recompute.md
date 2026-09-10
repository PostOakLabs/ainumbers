# Overdraft / NSF Fee Recomputation

Independently recomputes overdraft (OD) and non-sufficient-funds (NSF) fee events from a caller-supplied posted-transaction ledger and opening balance, applying the caller's own declared posting-order policy (as_supplied, high_to_low_amount, low_to_high_amount, or chronological_by_effective_date) and fee schedule (fee amounts, an optional daily fee-count cap, an optional representment-dedup window, and an optional extended-overdrawn fee tier), then diffs the recomputed fee totals against caller-supplied core-charged fees, aggregated by post_date and fee type. Posting order and every fee-schedule term are caller-declared inputs, never chosen or inferred; the kernel makes no claim about their legality or permissibility. Each ledger item declares whether the bank pays it into a negative balance (an OD event) or returns it unpaid (an NSF event, the conservative default when undeclared). The verdict is MATCHES, DIVERGES, or INDETERMINATE; INDETERMINATE covers an empty ledger, an incomplete fee schedule, or no core-charged fees supplied to compare against, never guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites Regulation DD (12 CFR Part 1030) for the fee-disclosure requirement and Regulation E (12 CFR Part 1005) for the authorization-hold concept behind the APSN pattern, both dated for re-verification against primary text. Stated boundary: this is an independent recompute and receipt, never a core alternative, a vendor audit, or an endorsement claim by any core vendor or platform, and a divergence is an arithmetic finding, never a determination that a fee was charged incorrectly or impermissibly, or is owed back.

- Page: https://ainumbers.co/tools/662-odnsf-fee-recompute.html
- Markdown twin: https://ainumbers.co/tools/662-odnsf-fee-recompute.md
- MCP tool: compute_odnsf_fee_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "account_token": "acct-demo-001",
  "period_label": "2026-08",
  "ledger": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_odnsf_fee_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
