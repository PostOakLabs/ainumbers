# GL Flux Explainer with Gate

Computes period-over-period movement per declared general-ledger account from integer minor-unit balances, compares each movement to a declared threshold policy (an absolute amount and a basis-point percentage, each a positive integer when present and left out to leave that test unconfigured; a declared rule for whether one or both must be exceeded, where both needs both thresholds and either needs at least one; plus optional per-account overrides), and ranks the breaches by absolute movement. Every breach needs a declared explanation id drawn from a caller-supplied reason-code list; a breach with none turns the gate to blocked, explained breaches route to review_required, and no breach reads clear. A zero prior balance never produces an infinite percentage: the percentage is reported as NOT_EVALUATED and the caller declares whether the absolute test alone applies or any movement breaches. A zero, negative or missing threshold is refused with THRESHOLD_NOT_POSITIVE or THRESHOLD_FIELD_MISSING, never a silent clear; a non-zero movement on a zero-prior account with no absolute threshold to test it carries ZERO_PRIOR_NOT_EVALUATED and the gate reads review_required at best. Free-text explanations, free-text policy versions, unknown keys and account-number-like ids are refused. Limits: a movement equal to the threshold counts as a breach, the basis-point figure is floored while the breach test is exact, balances and thresholds are capped at 1e15 minor units, lists at 5000 entries, and the account-number screen is a shape check plus a run of six or more digits, not proof an id carries no account number. Flags movements over a declared threshold and requires a declared explanation id for each. It does not judge whether an explanation is adequate.

- Page: https://ainumbers.co/chaingraph/art-840-gl-flux-explainer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-840-gl-flux-explainer.md
- MCP tool: explain_gl_flux_with_gate (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "accounts": [
    "CASH",
    "AR"
  ],
  "prior_balances": [
    {
      "account_id": "CASH",
      "minor_units": 100000
    },
    {
      "account_id": "AR",
      "minor_units": 50000
    }
  ],
  "current_balances": [
    {
      "account_id": "CASH",
      "minor_units": 100500
    },
    {
      "account_id": "AR",
      "minor_units": 50100
    }
  ],
  "threshold_policy": {
    "version": "FLUX-2026-Q4",
    "abs_minor_units": 10000,
    "pct_bps": 1000,
    "rule": "either",
    "zero_prior_rule": "abs_only"
  },
  "reason_codes": [
    "VOLUME",
    "TIMING"
  ],
  "explanations": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `explain_gl_flux_with_gate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
