# APY-Earned Recompute

Recomputes the annual percentage yield earned for a periodic statement from caller-declared inputs: the interest actually earned for the period, the average daily balance (supplied directly or derived as the days-weighted mean of caller-declared balance spans), and the actual days in the period, using the compound general formula of the cited rule text (100*((1+I/B)^(365/D)-1)), and diffs the recomputed yield against the caller-supplied disclosed figure within a declared accuracy band whose 0.05pp default is the rule text's own accuracy statement. Returns MATCHES, DIVERGES with the exact difference, or INDETERMINATE when inputs are outside the declared domain or no disclosed figure exists to diff against. The statement-more-often-than-compounding special formula is declared unsupported and refused, never approximated. An independent recompute-and-receipt over caller-declared contract inputs, not an audit of or substitution for any core platform, and not a claim about what any institution should have disclosed. NOTE: the build spec's simple-annualization variant does not reproduce the cited text's own worked examples and was not implemented; the divergence is recorded in the row check-off.

- Page: https://ainumbers.co/tools/663-apy-earned-recompute.html
- Markdown twin: https://ainumbers.co/tools/663-apy-earned-recompute.md
- MCP tool: compute_apy_earned_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "interest_earned": 5.25,
  "days_in_period": 30,
  "average_daily_balance": 1000,
  "disclosed_apy_earned": 6.58,
  "accuracy_band_pp": {
    "value": 0.05,
    "effective_from": "2019-07-03",
    "effective_to": null,
    "source": "12 CFR 1030.3(f)(2) accuracy tolerance for the annual percentage yield earned",
    "source_digest": "sha256:a31899e46c5b515c6e5b69bc6ec15ca0a4fb67e4e89ad45c772872cc4dc0a8fc"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_apy_earned_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
